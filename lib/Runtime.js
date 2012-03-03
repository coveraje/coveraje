/*
    coveraje - a simple javascript code coverage tool.
    
    runtime
    ---------------
    methods invoked from the generated file
    
    Copyright (c) 2011-2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/
(function () {
    "use strict";
    
    function CoverajeRuntime(instance) {
        var option = instance.options;
        var data = {};
        var startState = {};
        
        var isOwn = require("./utils").isOwn;
        
        function register_key(key) {
            if (!(key in data)) {
                return data[key] = {
                    visits: {},
                    branches: {}
                };
            }
            return data[key];
        }
        
        function visit_log(key, pos, endpos) {
            var idx = pos + "." + endpos;
            data[key].visits[idx].counter++;
        }
        
        function visit_register(key, pos, endpos) {
            var o = register_key(key).visits;
            
            var idx = pos + "." + endpos;
            if (!(idx in o)) {
                o[idx] = {pos: pos, endpos: endpos, counter: 0};
                return true;
            }
            return false;
        }
        
        function visitsArray(key, counted) {
            function sort(a, b) {
                if (a.s === b.s) {
                    if (a.e === b.e) {
                        return 0;
                    }
                    return a.e < b.e ? 1 : -1;
                }
                return a.s < b.s ? -1 : 1;
            }
            
            var ret = {};
            var idx;
            
            for (var k in data) {
                if (isOwn(data, k) && (key == null || key === k)) {
                    ret[k] = [];
                    var o = data[k].visits;
                    for (idx in o) {
                        if (isOwn(o, idx)) {
                            var v = o[idx];
                            ret[k].push({s: v.pos, e: v.endpos, c: v.counter, i: counted.indexOf(v.counter)});
                        }
                    }
                    
                    ret[k].sort(sort);
                }
            }
            return ret;
        }
        
        function branchesArray(key) {
            var ret = {};
            var idx, iidx;
            var br, bs, hasUncovered;
            
            for (var k in data) {
                if (isOwn(data, k) && (key == null || key === k)) {
                    var o = data[k].branches;
                    ret[k] = [];
                    for (idx in o) {
                        if (isOwn(o, idx)) {
                            br = o[idx];
                            bs = [];
                            hasUncovered = false;
                            for (iidx in br) {
                                if (iidx !== "pos" && iidx !== "endpos" && isOwn(br, iidx)) {
                                    var b = br[iidx];
                                    if (!hasUncovered && b.counter === 0) hasUncovered = true;
                                    bs.push({s: b.pos, e: b.endpos, c: b.counter});
                                }
                            }
                            
                            ret[k].push({s: br.pos, e: br.endpos, u: hasUncovered, b: bs});
                        }
                    }
                }
            }
            return ret;
        }
        
        function copy(o) {
            var ret, i, il, oks;
            
            if (o == null) {
                ret = null;
            } else if (Array.isArray(o)) {
                ret = [];
                for (i = 0, il = o.length; i < il; i++) {
                    ret.push(copy(o[i]));
                }
            } else if (typeof o === "object") {
                ret = {};
                oks = Object.keys(o);
                for (i = 0, il = oks.length; i < il; i++) {
                    var k = oks[i];
                    ret[k] = copy(o[k]);
                }
            } else {
                ret = o;
            }
            return ret;
        }
        
        return {
            init: function (key) {
                if (key == null) {
                    data = {};
                    startState = {};
                } else {
                    delete data[key];
                }
            },
            
            setStartState: function (key) {
                if (data != null && key != null) {
                    if (startState[key] == null && data[key] != null) {
                        startState[key] = copy(data[key]);
                    }
                }
            },
            
            reset: function (key) {
                var idx, iidx;
                for (var k in data) {
                    if (isOwn(data, k) && (key == null || key === k)) {
                        var start = startState[k] || {};
                        
                        var visits = data[k].visits;
                        var visits_start = start.visits || {};
                        for (idx in visits) {
                            if (isOwn(visits, idx)) {
                                visits[idx].counter = visits_start[idx] == null ? 0 : visits_start[idx].counter;
                            }
                        }
                        
                        var branches = data[k].branches;
                        var branches_start = start.branches || {};
                        for (idx in branches) {
                            if (isOwn(branches, idx)) {
                                var bd = branches[idx];
                                var bd_start = branches_start[idx] || {};
                                for (iidx in bd) {
                                    if (isOwn(bd, iidx) && bd[iidx].counter != null) {
                                        bd[iidx].counter = bd_start[iidx] == null ? 0 : bd_start[iidx].counter;
                                    }
                                }
                            }
                        }
                    }
                }
            },
            
            visits: {
                register: visit_register,
                call: visit_log,
                
                callWithRet: function (key, expr, pos, endpos) {
                    visit_log(key, pos, endpos);
                    return expr;
                },
                
                callWithRetIfTrue : function (key, expr, pos, endpos) {
                    if (expr) visit_log(key, pos, endpos);
                    return expr;
                },
                
                funcargs: function (key, args, positions) {
                    var m = Math.min(args.length, positions.length);
                    for (var i = 0; i < m; i++) {
                        visit_log(key, positions[i].pos, positions[i].endpos);
                    }
                },
                
                isCovered: function (el) {
                    return el.c > 0;
                }
            },
            
            branches: {
                register: function (key, kpos, kend, pos, endpos, isElse) {
                    if (pos !== 0 && endpos !== 0) {
                        visit_register(key, pos, endpos);
                    }
                    
                    var idx = kpos + "." + kend;
                    var branches = data[key].branches;
                    if (!(idx in branches)) {
                        branches[idx] = { pos: kpos, endpos: kend };
                    }
                    
                    var iidx = pos + "." + endpos;
                    if (!(iidx in branches[idx])) {
                        branches[idx][iidx] = {pos: pos, endpos: endpos, isElse: isElse, counter: 0};
                    }
                },
                
                call: function (key, kpos, kend, pos, endpos) {
                    if (pos !== 0 && endpos !== 0) {
                        visit_log(key, pos, endpos);
                    }
                    var idx = kpos + "." + kend;
                    var branches = data[key].branches;
                    if (idx in branches) {
                        var iidx = pos + "." + endpos;
                        if (iidx in branches[idx]) {
                            branches[idx][iidx].counter++;
                        }
                    }
                },
                
                callWithRet: function (key, expr, kpos, kend, pos, endpos) {
                    this.call(key, kpos, kend, pos, endpos);
                    return expr;
                },
                
                isCovered: function (el) {
                    return !el.u;
                }
            },
            
            helper: (function () {
                if (typeof require === "undefined") return;
                
                var requirePostfix = "$$_cj_inspected";
                var requires = option.resolveRequires,
                    keys = [],
                    path = require("path"),
                    Module = require("module");
                    
                function requireCode(code, pathToCode, context, runtimeKey) {
                    
                    function compile(content, mod, filename, dirname) {
                        var Script = process.binding('evals').NodeScript;
                        var runInThisContext = Script.runInThisContext;
                        
                        // create wrapper function
                        //
                        var wrapper = Module.wrap(
                            "var " + option.prefix + "runtime = exports['" + option.prefix + "runtime'];\n" +
                            content + "\n" +
                            option.prefix + "runtime.setStartState(" + runtimeKey + ");"
                        );
                        
                        mod.exports = context;
                        
                        var compiledWrapper = runInThisContext(wrapper, filename, true);
                        var args = [mod.exports, module.require, mod, filename, dirname];
                        
                        return compiledWrapper.apply(mod.exports, args);
                    }
                    
                    var filepath = path.resolve(process.cwd(), pathToCode);
                    var dirname = path.dirname(filepath);
                    var cacheKey = filepath + requirePostfix;
                    
                    var cachedModule = Module._cache[cacheKey];
                    if (cachedModule) {
                        return cachedModule.exports;
                    }
                    keys.push(cacheKey);
                    
                    var mod = new Module(cacheKey, module);
                    Module._cache[cacheKey] = mod;
                    
                    mod.filename = filepath;
                    mod.paths = Module._nodeModulePaths(dirname);
                    
                    if (context != null) {
                        compile(code, mod, filepath, dirname);
                    } else {
                        mod._compile(code, filepath);
                    }
                    mod.loaded = true;
                    return mod.exports;
                }
                
                function requireFrom(filepath) {
                    var content = require("fs").readFileSync(filepath, 'utf-8');
                    var code = instance.addCode(filepath, content);
                    
                    var ctx = {};
                    ctx[option.prefix + "runtime"] = instance.runtime;
                    
                    return requireCode(code.codeToRun, filepath, ctx, code.index);
                }
                function requireTest(m, self) {
                    var ret = {
                        useDefault: true,
                        filename: m
                    };
                    
                    if (m.charAt(0) === "." || m.indexOf(":") !== -1) {
                        var rp = path.resolve(path.dirname(self.filename), m);
                        var filename = Module._resolveFilename(rp, self);
                        if (Array.isArray(filename)) filename = filename[1];
                        
                        ret.filename = filename;
                        if (requires && (requires.indexOf(filename) !== -1 || requires.indexOf("*") !== -1)) {
                            ret.useDefault = false;
                        }
                    }
                    
                    return ret;
                }
                
                return {
                    requireReset: function () {
                        for (var i = 0, il = keys.length; i < il; i++) {
                            delete Module._cache[keys[i]];
                        }
                        keys.length = 0;
                    },
                    
                    require: function (m, self) {
                        var tst = requireTest(m, self);
                        
                        if (tst.useDefault) {
                            return self.require(tst.filename);
                        }
                        return requireFrom(tst.filename);
                    },
                    
                    requireTest: requireTest
                };
            }()),
            
            reportData: function (key) {
                var counted = [];
                var idx, v;
                for (var k in data) {
                    if (isOwn(data, k) && (key == null || key === k)) {
                        var visits = data[k].visits;
                        for (idx in visits) {
                            if (isOwn(visits, idx)) {
                                v = visits[idx];
                                if (counted.indexOf(v.counter) === -1) {
                                    counted.push(v.counter);
                                }
                            }
                        }
                    }
                }
                
                counted = counted.sort(function (a, b) {
                    if (a === b) return 0;
                    if (a < b) return -1;
                    return 1;
                });
                
                if (counted[0] !== 0) counted.splice(0, 0, 0);
                
                return {
                    counted: counted,
                    visits: visitsArray(key, counted),
                    branches: branchesArray(key)
                };
            },

            getResults: function (key) {
                var data = this.reportData(key);
                var totalCount = 0, totalCovered = 0, totalAreas = 0;
                var results = {};
                
                function setTotal(obj) { /*jshint bitwise: false*/
                    if (obj.items !== 0) {
                        obj.coverage = (obj.covered / obj.items * 10000 | 0) / 100;
                    } else {
                        obj.coverage = 0;
                    }
                }
                
                function calc(name, filter) {
                    var result, vl, vlt;
                    
                    var o = data[name];
                    if (o != null) {
                        for (var k in o) {
                            if (isOwn(o, k)) {
                                var els = o[k];
                                vl = els.length;
                                totalCount += vl;

                                if (vl > 0) {
                                    if (result == null) {
                                        result = {
                                            items: 0,
                                            covered: 0
                                        };
                                    }

                                    vlt = els.filter(filter).length;
                                    totalCovered += vlt;
                                    
                                    result.items += vl;
                                    result.covered += vlt;
                                }
                            }
                        }
                        
                        if (result != null) {
                            totalAreas++;
                            setTotal(result);
                            results[name] = result;
                        }
                    }
                }

                calc("visits", this.visits.isCovered);
                calc("branches", this.branches.isCovered);
                
                results.total = {
                    areas: totalAreas,
                    items: totalCount,
                    covered: totalCovered
                };
                setTotal(results.total);
                return results;
            }
        };
    }
    
    if (typeof module !== "undefined") {
        module.exports = CoverajeRuntime;
    }
}());