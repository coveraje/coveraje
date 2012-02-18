/*
    coveraje - a simple javascript code coverage tool.
    
    the main module
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

(function () {
    "use strict";
    
    var version = "0.1.3", // Keep in sync with `package.json` and `history.md`.
        defaultOptions = {
            beautify: false,
            colorizeShell: true,
            globals: "",
            
            prefix: "_cj$_",
            
            resolveRequires: [],
            
            quiet: false,
            
            stripFirstComments: true,
            stripSheBang: true,
            
            wait: 0
        };
        
    var uglifyjs = require("uglify-js"),
        CoverajeEvent = require("./EventEmitter").CoverajeEvent,
        CoverajeRuntime = require("./Runtime").CoverajeRuntime,
        utils = require("./utils").utils;
        
    var isOwn = utils.isOwn;
    
    function Coveraje(code, runner, options) {
        var instance = this,
            errors = [],
            codes = {},
            codeToRun,
            option = utils.doOptions(options, defaultOptions),
            instanceEvents = new CoverajeEvent();
            
        var runtime = new CoverajeRuntime(option, instance),
            testRunner = new (require("./TestRunner").TestRunner)(option, instance),
            shell = require("./shell").createShell(option);
        
        //
        // ast manipulation
        var injector = (function () {
            function startElement(expr) {
                if (expr != null) {
                    if (Array.isArray(expr)) {
                        for (var i = 0, il = expr.length; i < il; i++) {
                            var r = startElement(expr[i]);
                            if (r) {
                                return r;
                            }
                        }
                    } else if (typeof expr === "object" && expr.start != null) {
                        return expr;
                    }
                }
            }
            
            function endElement(expr) {
                if (expr != null) {
                    if (Array.isArray(expr)) {
                        for (var i = expr.length - 1; i >= 0; i--) {
                            var r = endElement(expr[i]);
                            if (r) {
                                return r;
                            }
                        }
                    } else if (typeof expr === "object" && expr.end != null) {
                        return expr;
                    }
                }
            }
            
            function block(body) {
                var r = [];
                for (var i = 0, il = arguments.length; i < il; i++) {
                    r.push(arguments[i]);
                }
                return [
                    "block",
                    r
                ];
            }
            
            function stat(expr) {
                return [
                    "stat",
                    expr
                ];
            }
            
            function isEmptyBlock(expr) {
                if (expr[0].toString() === "block") {
                    if (expr[1] == null || expr[1].length === 0) {
                        return true;
                    }
                }
                return false;
            }
            
            function callRuntime(obj, member, params) {
                return [
                    "call",
                    [
                        "dot",
                        [
                            "dot",
                            [ "name", option.prefix + "runtime" ],
                            obj
                        ],
                        member
                    ],
                    params
                ];
            }
            
            //
            // visits
            function visithelp(r) {
                return function (expr, key, unmodified, select) {
                    var pos = 0;
                    var so = startElement(select || unmodified);
                    
                    if (so) {
                        var start = so.start;
                        if (start) {
                            pos = start.pos;
                            if (pos != null) {
                                var eo = endElement(select || unmodified);
                                if (eo == null && so != null) {
                                    eo = so;
                                    if (eo.end == null) eo.end = eo.start;
                                }
                                if (eo != null && eo.end != null) {
                                    var endpos = eo.end.endpos;
                                    
                                    if (so && so.end && endpos < so.end.endpos) {
                                        endpos = so.end.endpos;
                                    }
                                    
                                    var ret = r(expr, key, pos, endpos);
                                    if (ret === false) {
                                        return expr;
                                    }
                                    runtime.visits.register(key, pos, endpos);
                                    return ret;
                                }
                            }
                        }
                    }
                    return expr;
                };
            }
            
            var addVisitAndReturnValue = visithelp(function (expr, key, pos, endpos) {
                return callRuntime("visits", "callWithRet", [ [ "num", key ], expr, [ "num", pos ], [ "num", endpos ] ]);
            });
            
            var addVisitAndReturnValueIfSingleExpr = visithelp(function (expr, key, pos, endpos) {
                if (expr[0].toString() === "binary" && (expr[1] === "||" || expr[1] === "&&")) {
                    return false;
                }
                return callRuntime("visits", "callWithRet", [ [ "num", key ], expr, [ "num", pos ], [ "num", endpos ] ]);
            });
            
            var callVisitFunc = visithelp(function (expr, key, pos, endpos) {
                return stat(callRuntime("visits", "call", [ [ "num", key ], [ "num", pos ], [ "num", endpos ] ]));
            });
            
            function callVisitFuncParams(func, key, args) {
                var argArr = args.map(function (arg) {
                    runtime.visits.register(key, arg.pos, arg.endpos);
                    return [ "object", [ [ "pos", [ "num", arg.pos ] ], [ "endpos", [ "num", arg.endpos ] ] ] ];
                });
                if (argArr.length === 0) return null;
                return stat(callRuntime("visits", "funcargs", [ [ "num", key], [ "name", "arguments" ], [ "array", argArr] ]));
            }
            
            var addVisit = visithelp(function (expr, key, pos, endpos) {
                var vc = stat(callRuntime("visits", "call", [ [ "num", key ], [ "num", pos ], [ "num", endpos ] ]));
                
                if (expr && expr.length > 0 && !isEmptyBlock(expr)) {
                    return block(
                        vc,
                        expr
                    );
                }
                return vc;
            });
            
            //
            // branches
            function branchhelp(r) {
                return function (expr, key, branch, keyword, isElse) {
                    var ks = startElement(keyword);
                    if (ks && ks.start) {
                        var pos = 0, endpos = 0;
                        var so = startElement(branch);
                        if (so && so.start) {
                            pos = so.start.pos;
                            endpos = so.start.endpos;
                            if (so.end) {
                                endpos = so.end.endpos;
                            }
                        }
                        var kpos = ks.start.pos, kend = ks.start.endpos;
                        
                        runtime.branches.register(key, kpos, kend, pos, endpos, isElse);
                        return r(expr, key, kpos, kend, pos, endpos);
                    }
                    return expr;
                };
            }
            
            function branchTesterName(keywordPos, keywordEndpos) {
                return option.prefix + "branch_" + keywordPos + "_" + keywordEndpos;
            }
            
            var addBranchSwitch = branchhelp(function (expr, key, keywordPos, keywordEndpos, branchPos, branchEndpos) {
                var bc = callRuntime("branches", "call", [ [ "num", key ], [ "num", keywordPos ], [ "num", keywordEndpos ], [ "num", branchPos ], [ "num", branchEndpos ] ]);
                
                var nam = [ "name", branchTesterName(keywordPos, keywordEndpos) ];
                var ifbc = [
                    "if",
                    [
                        "unary-prefix",
                        "!",
                        nam
                    ],
                    [ "block", [ [ "stat", [ "assign", true, nam, [ "name", "true" ] ] ], bc ] ]
                ];
                
                expr.splice(0, 0, ifbc);
                return expr;
            });
            
            var addBranchIf = branchhelp(function (expr, key, keywordPos, keywordEndpos, branchPos, branchEndpos) {
                var ret = stat(callRuntime("branches", "call", [ [ "num", key ], [ "num", keywordPos ], [ "num", keywordEndpos ], [ "num", branchPos ], [ "num", branchEndpos ] ]));
                
                if (expr && expr.length > 0 && !isEmptyBlock(expr)) {
                    return block(
                        ret,
                        expr
                    );
                }
                return ret;
            });
            
            //
            // walker to inject everything needed for code coverage
            function ast_inject(ast, code, key) {
                var w = uglifyjs.uglify.ast_walker(),
                    walk = w.walk,
                    MAP = uglifyjs.uglify.MAP,
                    slice = uglifyjs.parser.slice;
                
                var ws = {
                    "stat": function (stat) {
                        // all but anomymous function calls
                        if (this[0].start) {
                            return addVisit([ this[0], walk(stat) ], key, stat, [ { start: this[0].start } ]);
                        }
                    },
                    
                    "var": function (defs) {
                        if (this[0].start) {
                            return addVisit([ this[0], MAP(defs, function (def) {
                                var a = [ def[0] ];
                                if (def.length > 1)
                                    a[1] = walk(def[1]);
                                return a;
                            }) ], key, this, [ { start: this[0].start, end: this[0].start } ]);
                        }
                    },
                    
                    "binary": function (op, left, right) {
                        if (op === "||" || op === "&&") {
                            return [
                                this[0],
                                op,
                                addVisitAndReturnValue(walk(left), key, left),
                                addVisitAndReturnValue(walk(right), key, right)
                            ];
                        }
                    },
                    
                    "conditional": function (cond, t, e) {
                        return [
                            this[0],
                            addVisitAndReturnValueIfSingleExpr(walk(cond), key, cond),
                            addVisitAndReturnValue(walk(t), key, t),
                            addVisitAndReturnValue(walk(e), key, e)
                        ];
                    },
                    
                    "if": function (cond, t, e) {
                        if (e == null) {
                            e = ["block", []];
                        }
                        
                        var ifbl, elbl;
                        
                        var ce = endElement(cond).end;
                        var ts = startElement(t).start;
                        
                        var epos = ce.endpos;
                        
                        var xcode = code.substring(epos, ts.pos);
                        var tok = uglifyjs.parser.tokenizer(xcode);
                        
                        var token;
                        while ((token = tok()).type !== "eof") {
                            if (token.type === "punc" && token.value === ")") {
                                ifbl = [ { start: { pos: epos + token.pos, endpos: epos + token.endpos } } ];
                                // parenthesis inside the condition are ommitted by uglifyjs. So test for the last occurence
                            } else if (ifbl != null) {
                                break;
                            }
                        }
                        
                        if (e && e[0].start) {
                            var te = endElement(t).end;
                            var es = startElement(e).start;
                            
                            xcode = code.substring(te.endpos, es.pos);
                            tok = uglifyjs.parser.tokenizer(xcode);
                            while ((token = tok()).type !== "eof") {
                                if (token.type === "keyword" && token.value === "else") {
                                    elbl = [ { start: { pos: te.endpos + token.pos, endpos: te.endpos + token.endpos } } ];
                                    break;
                                }
                            }
                        }
                        
                        return [
                            this[0],
                            addVisitAndReturnValueIfSingleExpr(walk(cond), key, cond),
                            addBranchIf(walk(t), key, ifbl, this, false),
                            addBranchIf(walk(e), key, elbl, this, true)
                        ];
                    },
                    
                    "switch": function (expr, body) {
                        var s = startElement(this);
                        if (s && s.start) {
                            var nam = branchTesterName(s.start.pos, s.start.endpos);
                            
                            if (body[body.length - 1][0] !== null) {
                                body.push([null, [ [ "break", null ] ]]);
                            }
                            
                            var eidx = endElement(expr).end.endpos;
                            
                            
                            var t = this;
                            return block(
                                [ "var", [ [ nam, [ "name", "false" ] ] ] ],
                                [
                                    this[0],
                                    addVisitAndReturnValueIfSingleExpr(walk(expr), key, expr),
                                    MAP(body, function (branch) {
                                        var sb = startElement(branch);
                                        if (!sb) {
                                            sb = endElement(body);
                                        }
                                        var sbidx = sb.start.pos;
                                        var xcode = code.substring(eidx, sbidx);
                                        var leidx = eidx;
                                        
                                        var eb = endElement(branch);
                                        if  (!eb) {
                                            eb = endElement(body);
                                        }
                                        eidx = eb.end.endpos;
                                        
                                        var isDefault = !branch[0];
                                        var tok = uglifyjs.parser.tokenizer(xcode);
                                        
                                        var token, inArgs = false;
                                        while ((token = tok()).type !== "eof") {
                                            if (token.type === "keyword") {
                                                if (token.value === "case" || token.value === "default") {
                                                    return [
                                                        isDefault ? null: walk(branch[0]),
                                                        addBranchSwitch(
                                                            MAP(branch[1], walk),
                                                            key,
                                                            [ { start: { pos: leidx + token.pos, endpos: leidx + token.endpos } } ],
                                                            t, isDefault
                                                        )
                                                    ];
                                                }
                                            }
                                        }
                                        
                                        return branch;
                                    })
                                ]
                            );
                        }
                    },
                    
                    "for": function (init, cond, step, block) {
                        return [
                            this[0],
                            walk(init),
                            addVisitAndReturnValueIfSingleExpr(walk(cond), key, cond),
                            addVisitAndReturnValueIfSingleExpr(walk(step), key, step),
                            walk(block)
                        ];
                    },
                    
                    "while": function (cond, block) {
                        return [
                            this[0],
                            addVisitAndReturnValueIfSingleExpr(walk(cond), key, cond),
                            walk(block)
                        ];
                    },
                    
                    "function": function (name, args, body) {
                        var s = startElement(this);
                        if (s && s.start) {
                            // function keyword
                            var func = [ { start: s.start } ];
                            
                            // arguments
                            var ar = [];
                            var bs = startElement(body);
                            if (bs && bs.start) {
                                var startIdx = s.start.endpos;
                                var xcode = code.substring(startIdx, bs.start.pos);
                                var tok = uglifyjs.parser.tokenizer(xcode);
                                
                                var token, inArgs = false;
                                while ((token = tok()).type !== "eof") {
                                    if (!inArgs && token.type === "punc" && token.value === "(") {
                                        inArgs = true;
                                    } else if (inArgs) {
                                        if (token.type === "name") {
                                            ar.push({ pos: token.pos + startIdx, endpos: token.endpos + startIdx });
                                        } else if (token.type === "punc" && token.value === ")") {
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // skip directives
                            var startAt = 0, bodyStat, i;
                            var bl = body.length;
                            for (i = 0; i < bl; i++) {
                                bodyStat = body[i];
                                if (bodyStat[0].toString() === "stat" && bodyStat[1].length === 2 && bodyStat[1][0].toString() === "string") {
                                    startAt++;
                                    continue;
                                }
                                break;
                            }
                            
                            var newBody = MAP(body, function (bodyStat, idx) {
                                if (idx >= startAt) {
                                    return walk(bodyStat);
                                }
                                return bodyStat;
                            });
                            
                            var tmp = callVisitFuncParams(func, key, ar);
                            if (tmp != null) newBody.splice(startAt, 0, tmp);
                            tmp = callVisitFunc([], key, body, func);
                            if (tmp != null) newBody.splice(startAt, 0, tmp);
                            
                            return [
                                this[0],
                                name,
                                args.slice(),
                                newBody
                            ];
                        }
                    },
                    
                    "seq": function () {
                        return [ this[0] ].concat(MAP(slice(arguments), function (se) {
                            return addVisitAndReturnValue(walk(se), key, se);
                        }));
                    },
                    
                    "return": function (expr) {
                        if (this[0].start) {
                            return addVisit([ this[0], walk(expr) ], key, this, [ { start: this[0].start, end: this[0].start } ]); // select only keyword
                        }
                    },
                    
                    "break": function (label) {
                        return addVisit([ this[0], label ], key, this);
                    }
                };
                
                ws["do"] = ws["while"];
                ws.defun = ws["function"];
                ws["throw"] = ws["return"];
                ws["continue"] = ws["break"];
                
                if (option.resolveRequires.length > 0) {
                    ws.call = function (expr, args) {
                        if (expr[0] === "name" && expr[1] === "require" && args.length === 1) {
                            args.push(["name", "module"]);
                            return callRuntime("helper", "require", args);
                        }
                    };
                }
                
                return w.with_walkers(ws, function () {
                    return walk(ast);
                });
            }
            
            //
            // parses the code, inject the needed statements and return generated code
            function parseAndInject(code, key) {
                var ast;
                try {
                    ast = uglifyjs.parser.parse(code, false, true);
                } catch (ex) {
                    throw ex.message;
                }
                runtime.init(key);
                ast = ast_inject(ast, code, key);
                
                return uglifyjs.uglify.gen_code(ast, { beautify: false });
            }
            
            return {
                parseAndInject: parseAndInject
            };
        }());
        
        //
        // removes #! (shebang) in first line (uglify-js don't like it)
        // removes \r from \r\n (easier to calculate positions)
        // removes first comments (better overview)
        function prepare(code) {
            var skippedLines = 0;
            code = code || "";
            
            if (option.stripSheBang && code.length > 1) {
                if (code.substr(0, 2) === "#!") {
                    code = code.substr(code.indexOf("\n") + 1);
                    skippedLines++;
                }
            }
            
            if (option.beautify) {
                try {
                    code = uglifyjs.uglify.gen_code(uglifyjs.parser.parse(code), { beautify: true });
                } catch (ex) {
                }
            } else {
                code = code.replace(/\r(?=\n)/g, "").replace(/\r/g, "\n");
                
                if (option.stripFirstComments) {
                    code = code.replace(/^(?:\s*(?:(?:\/[*](?:[^*]|[*][^\/])*[*]\/)|(?:\/\/.*\n?)))+/, function (d) {
                        skippedLines += d.split("\n").length - 1;
                        return "";
                    });
                }
            }
            
            code = code.replace(/^([ \t]*\n)+/, function (d) {
                skippedLines += d.split("\n").length - 1;
                return "";
            });
            
            return {
                code: code,
                skippedLines: skippedLines
            };
        }
        
        function createRunner() {
            return testRunner.runTest(codes["initial code"], runner);
        }
        
        function addCode(name, code) {
            if (codes[name] == null) {
                var prep = prepare(code);
                var idx = Object.keys(codes).length;
                
                codes[name] = {
                    index: idx,
                    name: name,
                    skippedLines: prep.skippedLines,
                    code: prep.code,
                    codeToRun: injector.parseAndInject(prep.code, idx)
                };
            }
            return codes[name];
        }
        
        function load(t, code) {
            var cde;
            
            codes = {};
            runtime.helper.requireReset();
            
            shell.writeLine("Load code.");
            if (typeof code === "function") {
                cde = code();
            } else if (typeof code === "string") {
                cde = code;
            }
            
            if (typeof cde === "string") {
                addCode("initial code", cde);
                return true;
            }
            return false;
        }
        
        function getCodes(f) {
            if (typeof f === "function") {
                var ret = [];
                var ks = Object.keys(codes);
                
                for (var i = 0, il = ks.length; i < il; i++) {
                    var r = f(codes[ks[i]], i);
                    if (r != null) {
                        ret.push(r);
                    }
                }
                return ret;
            }
            
            return codes;
        }
        
        return (function (t) {
            // main entry
            
            instanceEvents.onError(function (key, err) {
                errors.push({ runner: key, value: err });
            });
            
            t.createRunner = createRunner;
            t.onComplete = instanceEvents.onComplete;
            t.complete = instanceEvents.complete;
            t.onError = instanceEvents.onError;
            t.error = instanceEvents.error;
            t.runtime = runtime;
            t.errors = errors;
            t.addCode = addCode;
            t.getCodes = getCodes;
            t.load = function (code) {
                t.isInitialized = load(t, code);
                return t.isInitialized;
            };
            t.options = option;
            
            var rep;
            t.report = function (format, options) {
                if (rep == null) {
                    rep = require("./report").report(t);
                }
                return rep.create(format, options);
            };
            
            if (load(t, code)) {
                t.isInitialized = true;
            }
            return t;
        }(instance));
    }
    
    Coveraje.version = version;
    Coveraje.defaultOptions = defaultOptions;
    
    if (typeof exports !== "undefined" && exports) {
        exports.Coveraje = Coveraje;
    }
}());
