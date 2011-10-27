/*
    coveraje - a simple javascript code coverage tool.
    
    the main module
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

/*jshint
    node: true,
    white: true,
    eqnull: true,
    multistr: true,
    plusplus: false,
    regexp: false,
    strict: true,
    
    bitwise: true,
    eqeqeqe: true,
    forin: true,
    immed: true,
    latedef: true,
    newcap: true,
    noarg: true,
    noempty: true,
    nonew: true,
    undef: true,
    trailing: true
*/

var coveraje = (function () {
    "use strict";
    
    var version = "0.1.0",
        defaultOptions = {
            debug: false,
            colorizeShell: true,
            globals: "",
            
            prefix: "_cj$_",
            quiet: false,
            
            serverHost: "127.0.0.1",
            serverPort: 13337,
            
            stripFirstComments: true,
            stripSheBang: true,
            
            useServer: false,
            
            wait: 0
        };
    
    var CoverajeEvent = require("./CoverajeEvent").CoverajeEvent;
    
    //
    // helper for "hasOwnProperty"
    var hop = Object.prototype.hasOwnProperty;
    function isOwn(object, name) {
        return hop.call(object, name);
    }
    
    function Coveraje(code, runner, options) {
        var instance,
            runtime = new (require("./coverajeRuntime.js").CoverajeRuntime)(),
            option = (function () {
                if (!options) options = {};
                for (var key in defaultOptions) {
                    if (isOwn(defaultOptions, key)) {
                        if (options[key] == null) {
                            options[key] = defaultOptions[key];
                        }
                    }
                }
                return options;
            }());
        
        //
        // helper for output values to shell
        var shell = (function () {
            var util = require("util");
            
            var formatRegExp = /%(\d*)([sdj%])(\d*)/g;
            function format(f) {
                var i;
                if (typeof f !== "string") {
                    var objects = [];
                    for (i = 0; i < arguments.length; i++) {
                        objects.push(util.inspect(arguments[i]));
                    }
                    return objects.join(" ");
                }

                i = 1;
                var args = arguments;
                var len = args.length;
                var str = f.replace(formatRegExp, function (x, padl, type, padr) {
                    var ret;
                    if (type === "%") {
                        ret = "%";
                    } else if (i >= len) {
                        ret = x;
                    }
                    
                    switch (type) {
                        /*jshint white: false */
                        case "s":
                            ret = String(args[i++]);
                            break;
                        case "d":
                            ret = Number(args[i++]).toString();
                            break;
                        case "j":
                            ret = JSON.stringify(args[i++]);
                            break;
                        default:
                            ret = x;
                            break;
                    }
                    
                    if (padl !== "") {
                        padl = parseInt(padl, 10);
                        if (ret.length < padl) {
                            ret = new Array(padl - ret.length + 1).join(" ") + ret;
                        }
                    }
                    if (padr !== "") {
                        padr = parseInt(padr, 10);
                        if (ret.length < padr) {
                            ret = ret + new Array(padr - ret.length + 1).join(" ");
                        }
                    }
                    
                    return ret;
                });
                
                for (var x = args[i]; i < len; x = args[++i]) {
                    if (x === null || typeof x !== "object") {
                        str += " " + x;
                    } else {
                        str += " " + util.inspect(x);
                    }
                }
                return str;
            }
            
            var colorDef = [
                "black",
                "red",
                "green",
                "yellow",
                "blue",
                "pink",
                "cyan",
                "white"
            ];
            
            function colorize(txt) {
                var curr = [];
                var reset = "\x1B[m";
                var last = reset;
                return txt.replace(/<(?:(\/color)|(?:color\s+(\w+(?:\s+\w+)*)\s*))>/g, function (m, close, names) {
                    if (option.colorizeShell) {
                        if (close) {
                            if (curr.length === 0) {
                                last = reset;
                                return "";
                            }
                            last = curr.pop();
                            return last;
                        } else {
                            curr.push(last);
                            
                            var colors = names.split(/\s+/g);
                            var l = colors.length;
                            
                            var fg, bg, mod = "[";
                            
                            for (var i = 0; i < colors.length; i++) {
                                var color = colors[i];
                                var idx = colorDef.indexOf(color);
                                if (idx === -1) {
                                    if (color === "normal") {
                                        mod += "0;";
                                    } else if (color === "bright") {
                                        mod += "1;";
                                    } else if (color === "inverted") {
                                        mod += "7;";
                                    }
                                } else {
                                    if (fg == null) {
                                        fg = 30 + idx;
                                    } else if (bg == null) {
                                        bg = 40 + idx;
                                    }
                                }
                            }
                            
                            if (fg != null) {
                                last = "\x1B" + mod + fg;
                                if (bg != null) {
                                    last += ";" + bg;
                                }
                                last += "m";
                                return last;
                            }
                        }
                    }
                    return "";
                });
            }
            
            var ret = {
                format: format,
                colorize: colorize
            };
            
            if (option.quiet) {
                ret.write = function () {};
                ret.writeLine = ret.write;
            } else {
                ret.writeLine = function (text) {
                    console.log(colorize(format.apply(this, arguments)));
                };
                ret.write = function (text) {
                    process.stdout.write(colorize(format.apply(this, arguments)));
                };
            }
            
            return ret;
        }());
        
        function Runner() {
            var vm = require("vm"),
                CoverajeTimer = require("./CoverajeTimer").CoverajeTimer;
            
            function setNewTimer(ctx) {
                var timer = new CoverajeTimer();
                
                ctx.setTimeout = timer.setTimeout;
                ctx.clearTimeout = timer.clearTimeout;
                ctx.setInterval = timer.clearTimeout;
                ctx.clearInterval = timer.clearTimeout;
                ctx[option.prefix + "stopTimers"] = timer.stopTimers;
            }
            
            function createContext() {
                /*jshint browser: true*/
                var context = vm.createContext();
                
                context[option.prefix + "runtime"] = runtime;
                context.console = console;
                
                setNewTimer(context);
                
                var ctxs = option.globals.split(/\s+/g);
                var ctxl = ctxs.length;
                for (var i = 0; i < ctxl; i++) {
                    var bshared = false;
                    
                    if (ctxs[i] === "browser") {
                        if (context.window == null) {
                            try {
                                context.window = require("jsdom").jsdom().createWindow();
                            } catch (ex1) {
                                shell.writeLine("");
                                shell.writeLine("***********************************************************");
                                shell.writeLine("* <color bright red>ERROR</color>: failed to load jsdom                             *");
                                shell.writeLine("* download it from                                        *");
                                shell.writeLine("* <color bright white>https://github.com/tmpvar/jsdom</color>                         *");
                                shell.writeLine("* it has some known problems on windows due to contextify *");
                                shell.writeLine("* write an issue if you need to run it on windows         *");
                                shell.writeLine("***********************************************************");
                            }
                        }
                        if (context.window && context.window.XMLHttpRequest == null) {
                            try {
                                context.window.XMLHttpRequest = require("xmlhttprequest");
                            } catch (ex2) {
                                shell.writeLine("");
                                shell.writeLine("***********************************************************");
                                shell.writeLine("* <color bright yellow>WARNING</color>: failed to load xmlhttprequest                  *");
                                shell.writeLine("* window.XMLHttpRequest == undefined                      *");
                                shell.writeLine("* if needed, download it from                             *");
                                shell.writeLine("* <color bright white>https://github.com/driverdan/node-XMLHttpRequest</color>        *");
                                shell.writeLine("***********************************************************");
                            }
                        }
                    } else if (ctxs[i] === "node") {
                        if (context.global == null) context.global = global;
                        if (context.process == null) context.process = process;
                        if (context.require == null) context.require = require;
                        if (context.__filename == null) context.__filename = __filename;
                        if (context.__dirname == null) context.__dirname = __dirname;
                        if (context.module == null) context.module = module;
                        if (context.exports == null) context.exports = {};
                        if (context.__dirname == null) context.__dirname = __dirname;
                        if (context.__filename == null) context.__filename = __filename;
                    }
                }
                return context;
            }
            
            function run(runner, key, context, event) {
                var ctx = context;
                
                function postRun() {
                    // stop all timers now
                    process.nextTick(function () {
                        ctx[option.prefix + "stopTimers"]();
                        event.complete(key, ctx);
                    });
                }
                
                setNewTimer(ctx); // each run has its own timer
                
                var testEvent;
                
                shell.writeLine("run <color bright white>%s</color>", key || "");
                try {
                    testEvent = runner(ctx);
                } catch (ex) {
                    // stop all timers now
                    event.error(key, ex);
                    postRun();
                    return;
                }
                
                if (testEvent instanceof CoverajeEvent) {
                    testEvent
                        .onComplete(postRun)
                        .onError(function (msg) {
                            event.error(key, msg);
                        })
                        .start();
                } else if (option.wait === 0) {
                    postRun();
                } else {
                    ctx.setTimeout(postRun, option.wait);
                }
            }
            
            function runMultiple(runner, context, event) {
                var runKeys = [], rk, rkl;
                var completed = [], errors = [];
                
                for (rk in runner) {
                    if (isOwn(runner, rk) && typeof runner[rk] === "function") {
                        runKeys.push(rk);
                    }
                }
                
                rkl = runKeys.length;
                if (rkl === 0) {
                    event.complete("", context);
                } else if (rkl === 1) {
                    rk = runKeys[0];
                    run(runner[rk], rk, context, event);
                } else {
                    var me = new CoverajeEvent();
                    
                    me
                        .onComplete(function (key) {
                            if (completed.indexOf(key) === -1) {
                                completed.push(key);
                                shell.write(".");
                            }
                            
                            if (runKeys.length === completed.length) {
                                shell.writeLine(" complete");
                                
                                for (var i = 0; i < errors.length; i++) {
                                    event.error(errors[i].k, errors[i].m);
                                }
                                event.complete("", context);
                            }
                        })
                        .onError(function (key, msg) {
                            errors.push({k: key, m: msg});
                        });
                    
                    for (var i = 0; i < runKeys.length; i++) {
                        rk = runKeys[i];
                        run(runner[rk], rk, context, me);
                    }
                }
                
            }
            
            //
            // run the injected code and one or all test runners
            // in their own context
            function runTest(code, runner, key) {
                /*jshint browser: true*/
                var event = new CoverajeEvent();
                
                event
                    .onComplete(function () {
                        instance.complete(instance);
                    })
                    .onError(function (key, err) {
                        instance.errors.push({runner: key, value: err});
                    })
                    .onStart(function () {
                        runtime.reset();
                        var context = createContext();
                        
                        var ret;
                        try {
                            var script = vm.createScript(code, "extended code");
                            ret = script.runInContext(context);
                        } catch (ex2) {
                            event.error(key, ex2.stack ? ex2.stack : ex2);
                            return;
                        }
                        
                        if (key != null && key !== "") {
                            runner = runner[key];
                            if (typeof runner !== "function") {
                                event.error(key, key + " is not a valid runner");
                                return;
                            }
                        }
                        
                        if (typeof runner === "function") {
                            run(runner, key, context, event);
                        } else if (runner != null) {
                            runMultiple(runner, context, event);
                        } else { // set to complete, even if no runners are defined
                            event.complete();
                        }
                    });
                
                return event;
            }
            
            return {
                runTest: runTest
            };
        }
        
        //
        // ast manipulation
        var injector = (function () {
            function startElement(expr) {
                if (expr != null) {
                    if (Array.isArray(expr)) {
                        var l = expr.length;
                        for (var i = 0; i < l; i++) {
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
                        var l = expr.length;
                        for (var i = l - 1; i >= 0; i--) {
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
                var l = arguments.length;
                for (var i = 0; i < l; i++) {
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
            
            var uglifyjs = require("../deps/UglifyJS/uglify-js");
            
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
            function visithelp(r, test) {
                return function (expr, unmodified, select) {
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
                                    
                                    var ret = r(expr, pos, endpos);
                                    if (ret === false) {
                                        return expr;
                                    }
                                    runtime.visit.register(pos, endpos);
                                    return ret;
                                }
                            }
                        }
                    }
                    return expr;
                };
            }
            
            var addVisitAndReturnValue = visithelp(function (expr, pos, endpos) {
                return callRuntime("visit", "callWithRet", [ expr, [ "num", pos ], [ "num", endpos ] ]);
            });
            
            var addVisitAndReturnValueIfSingleExpr = visithelp(function (expr, pos, endpos) {
                if (expr[0].toString() === "binary" && (expr[1] === "||" || expr[1] === "&&")) {
                    return false;
                }
                return callRuntime("visit", "callWithRet", [ expr, [ "num", pos ], [ "num", endpos ] ]);
            });
            
            var addVisitFunc = visithelp(function (expr, pos, endpos) {
                var vc = stat(callRuntime("visit", "call", [ [ "num", pos ], [ "num", endpos ] ]));
                
                expr.splice(0, 0, vc);
                return expr;
            }, true);
            
            function addVisitFuncParams(expr, func, args) {
                var argArr = args.map(function (arg) {
                    runtime.visit.register(arg.pos, arg.endpos);
                    return [ "object", [ [ "pos", [ "num", arg.pos ] ], [ "endpos", [ "num", arg.endpos ] ] ] ];
                });
                
                var vc = stat(callRuntime("visit", "funcargs", [ [ "name", "arguments" ], [ "array", argArr ] ]));
                
                expr.splice(0, 0, vc);
                return expr;
            }
            
            var addVisit = visithelp(function (expr, pos, endpos) {
                var vc = stat(callRuntime("visit", "call", [ [ "num", pos ], [ "num", endpos ] ]));
                
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
                return function (expr, branch, keyword, isElse) {
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
                        
                        runtime.branch.register(kpos, kend, pos, endpos, isElse);
                        return r(expr, kpos, kend, pos, endpos);
                    }
                    return expr;
                };
            }
            
            function branchTesterName(keywordPos, keywordEndpos) {
                return option.prefix + "branch_" + keywordPos + "_" + keywordEndpos;
            }
            
            var addBranchSwitch = branchhelp(function (expr, keywordPos, keywordEndpos, branchPos, branchEndpos) {
                var bc = callRuntime("branch", "call", [ [ "num", keywordPos ], [ "num", keywordEndpos ], [ "num", branchPos ], [ "num", branchEndpos ] ]);
                
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
            
            var addBranchIf = branchhelp(function (expr, keywordPos, keywordEndpos, branchPos, branchEndpos) {
                var ret = stat(callRuntime("branch", "call", [ [ "num", keywordPos ], [ "num", keywordEndpos ], [ "num", branchPos ], [ "num", branchEndpos ] ]));
                
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
            function ast_inject(ast, code) {
                var w = uglifyjs.uglify.ast_walker(),
                    walk = w.walk,
                    MAP = uglifyjs.uglify.MAP,
                    slice = uglifyjs.parser.slice;
                
                var ws = {
                    
                    "stat": function (stat) {
                        // all but anomymous function calls
                        if (this[0].start) {
                            return addVisit([ this[0], walk(stat) ], stat, [{start: this[0].start}]);
                        }
                    },
                    
                    "var": function (defs) {
                        if (this[0].start) {
                            return addVisit([ this[0], MAP(defs, function (def) {
                                var a = [ def[0] ];
                                if (def.length > 1)
                                    a[1] = walk(def[1]);
                                return a;
                            }) ], this, [ {start: this[0].start, end: this[0].start } ]);
                        }
                    },
                    
                    "binary": function (op, left, right) {
                        if (op === "||" || op === "&&") {
                            return [
                                this[0],
                                op,
                                addVisitAndReturnValue(walk(left), left),
                                addVisitAndReturnValue(walk(right), right)
                            ];
                        }
                    },
                    
                    "conditional": function (cond, t, e) {
                        return [
                            this[0],
                            addVisitAndReturnValueIfSingleExpr(walk(cond), cond),
                            addVisitAndReturnValue(walk(t), t),
                            addVisitAndReturnValue(walk(e), e)
                        ];
                    },
                    
                    "if": function (cond, t, e) {
                        if (e == null) {
                            e = ["block", []];
                        }
                        
                        var ifbl, elbl, idx;
                        var s = startElement(t);
                        if (s && s.start) {
                            idx = code.substr(0, s.start.pos).lastIndexOf(")");
                            if (idx !== -1) {
                                ifbl = [ {start: {pos: idx, endpos: idx + 1} } ];
                            }
                        }
                        
                        s = startElement(e);
                        if (s && s.start) {
                            idx = code.substr(0, s.start.pos).lastIndexOf("else");
                            if (idx !== -1) {
                                elbl = [ {start: {pos: idx, endpos: idx + 4} } ];
                            }
                        }
                        
                        return [
                            this[0],
                            addVisitAndReturnValueIfSingleExpr(walk(cond), cond),
                            addBranchIf(walk(t), ifbl, this, false),
                            addBranchIf(walk(e), elbl, this, true)
                        ];
                    },
                    
                    "switch": function (expr, body) {
                        var s = startElement(this);
                        if (s && s.start) {
                            var nam = branchTesterName(s.start.pos, s.start.endpos);
                            
                            if (body[body.length - 1][0] !== null) {
                                body.push([null, [ [ "break", null ] ]]);
                            }
                            
                            var t = this;
                            return block(
                                [ "var", [ [ nam, [ "name", "false" ] ] ] ],
                                [
                                    this[0],
                                    addVisitAndReturnValueIfSingleExpr(walk(expr), expr),
                                    MAP(body, function (branch) {
                                        var isDefault = !branch[0];
                                        var bp = isDefault ? null : branch[0];
                                        var e, s, pos;
                                        
                                        // search for "case"- or "default"-keyword (not emitted by uglifyjs parser)
                                        s = startElement(branch);
                                        if (s && s.start) {
                                            pos = code.lastIndexOf(branch[0] ? "case" : "default", s.start.pos);
                                            if (pos > -1) {
                                                bp = [ {start: {pos: pos, endpos: branch[0] ? s.start.endpos : pos + 7} } ];
                                            }
                                        }
                                        
                                        return [
                                            isDefault ? null: walk(branch[0]),
                                            addBranchSwitch(MAP(branch[1], walk), bp, t, isDefault)
                                        ];
                                    })
                                ]
                            );
                        }
                    },
                    
                    "for": function (init, cond, step, block) {
                        return [
                            this[0],
                            walk(init),
                            addVisitAndReturnValueIfSingleExpr(walk(cond), cond),
                            addVisitAndReturnValueIfSingleExpr(walk(step), step),
                            walk(block)
                        ];
                    },
                    
                    "while": function (cond, block) {
                        return [
                            this[0],
                            addVisitAndReturnValueIfSingleExpr(walk(cond), cond),
                            walk(block)
                        ];
                    },
                    
                    "function": function (name, args, body) {
                        var s = startElement(this);
                        if (s && s.start) {
                            var idx = code.substr(0, s.start.pos).lastIndexOf("function");
                            if (idx !== -1) {
                                var func = [ { start: {pos: idx, endpos: idx + 8} } ];
                                
                                // arguments
                                var ar = [];
                                s = startElement(this[0]);
                                if (s && s.start) {
                                    var m = /\(\s*/.exec(code.substr(s.start.pos));
                                    if (m) {
                                        idx = s.start.pos + m.index + m[0].length;
                                        for (;;) {
                                            m = /\s*[,\)]\s*/.exec(code.substr(idx));
                                            
                                            if (m.index > 0) {
                                                ar.push({pos: idx, endpos: idx + m.index});
                                            }
                                            
                                            if (m[0].substr(m.length - 1, 1) === ")") {
                                                break;
                                            }
                                            idx += m.index + m[0].length;
                                        }
                                    }
                                }
                            
                                return [
                                    this[0],
                                    name,
                                    args.slice(),
                                    addVisitFuncParams(addVisitFunc(MAP(body, walk), body, func), func, ar)
                                ];
                            }
                        }
                    },
                    
                    "seq": function () {
                        return [ this[0] ].concat(MAP(slice(arguments), function (se) {
                            return addVisitAndReturnValue(walk(se), se);
                        }));
                    },
                    
                    "return": function (expr) {
                        if (this[0].start) {
                            return addVisit([ this[0], walk(expr) ], this, [ {start: this[0].start, end: this[0].start } ]); // select only keyword
                        }
                    },
                    
                    "break": function (label) {
                        return addVisit([ this[0], label ], this);
                    }
                };
                
                ws["do"] = ws["while"];
                ws.defun = ws["function"];
                ws["throw"] = ws["return"];
                ws["continue"] = ws["break"];
                
                return w.with_walkers(ws, function () {
                    return walk(ast);
                });
            }
            
            //
            // parses the code, inject the needed statements and return generated code
            function parseAndInject(code) {
                var ast = uglifyjs.parser.parse(code, false, true);
                
                runtime.init();
                ast = ast_inject(ast, code);
                
                return uglifyjs.uglify.gen_code(ast, { beautify: true, ascii_only: true });
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
            code = code || "";
            if (option.stripSheBang && code.length > 1) {
                if (code.substr(0, 2) === "#!") {
                    code = code.substr(code.indexOf("\n") + 1);
                }
            }
            
            code = code.replace(/\r(?=\n)/g, "");
            
            if (option.stripFirstComments) {
                code = code.replace(/^(?:\s*(?:(?:\/[*](?:[^*]|[*][^\/])*[*]\/)|(?:\/\/.*\n?))\n*)+/, "");
            }
            return code;
        }
        
        function runInConsole(instance) {
            var r = instance.createRunner();
            var hasError = false;
            
            r.runTest(instance.result, instance.runner)
                .onComplete(function (key, context) {
                    var data = runtime.reportData();
                    var vl, vlt, clt = 0, cl = 0;
                    
                    vl = data.visited.length;
                    cl += vl;
                    
                    shell.writeLine("");
                    shell.writeLine("         |  Items Tested | Coverage |");
                    shell.writeLine("---------+---------------+----------+");
                    if (vl > 0) {
                        vlt = data.visited.filter(runtime.visit.isTested).length;
                        clt += vlt;
                        shell.writeLine("Visits   |  <color bright white>%5d  %5d</color> |  <color bright white>%6s%</color> |", vl, vlt, (vlt / vl * 100).toFixed(2));
                    }
                    
                    vl = data.branches.length;
                    cl += vl;
                    if (vl > 0) {
                        vlt = data.branches.filter(runtime.branch.isTested).length;
                        clt += vlt;
                        shell.writeLine("Branches |  <color bright white>%5d  %5d</color> |  <color bright white>%6s%</color> |", vl, vlt, (vlt / vl * 100).toFixed(2));
                    }
                    shell.writeLine("---------+---------------+----------+");
                    
                    if (cl > 0) {
                        shell.writeLine("Total    |  <color bright white>%5d  %5d</color> |  <color bright white>%6s%</color> |", cl, clt, (clt / cl * 100).toFixed(2));
                    }
                })
                .onError(function (key, err) {
                    if (!hasError) {
                        hasError = true;
                        shell.writeLine("<color bright red>Errors:</color>");
                    }
                    shell.writeLine(key + ": <color bright white>" + err + "</color>");
                })
                .start();
        }
        
        function start() {
            if (option.useServer) {
                require("./coverajeWebserver.js").coverajeWebserver(instance).start();
            } else {
                runInConsole(instance);
            }
        }
        
        return (function () {
            // main entry
            if (typeof code === "string") {
                instance = new CoverajeEvent();
                instance.onComplete(function () {}); // to avoid errors
                
                instance.onStart(start);
                
                code = prepare(code);
                var result = injector.parseAndInject(code);
                
                // expose some helper functions/objects for internal use (needed for helpers, webserver, ..)
                instance.shell = shell;
                instance.runtime = runtime;
                instance.runner = runner;
                
                instance.createRunner = function () {
                    return new Runner();
                };
                instance.option = option;
                instance.code = code;
                instance.result = result;
                
                instance.errors = [];
                
                instance.isInitialized = true;
                
                return instance;
            }
            return null;
        }());
    }

    var runHelper = (function () {
        function createEmitter(f) {
            if (typeof f === "function") {
                var event = new CoverajeEvent();
                
                event.onStart(function () {
                    f(event);
                });
                
                return event;
            }
            return null;
        }
        
        var itself = function (framework) {
            return {
                run: function (file) {
                    return createEmitter(function (event) {
                        require("./helper").run(file, framework, event);
                    });
                }
            };
        };
        
        function Countdown(event, count, wait) {
            var tim;
            
            (function (t) {
                if (event instanceof CoverajeEvent) {
                    t.one = function () {
                        count--;
                        if (count === 0) {
                            if (tim) clearTimeout(tim);
                            event.complete();
                        }
                        return t;
                    };
                    
                    var w = Number(wait);
                    if (w != null && !isNaN(w) && isFinite(w) && count > 0) {
                        tim = setTimeout(function () {
                            count = 0;
                            event.error("Test cancelled after <color yellow>" + (w / 1000).toPrecision(3).replace(/\.?0+$/, "") + "</color> seconds.");
                            event.complete();
                        }, w);
                    }
                } else {
                    t.one = function () {
                        return t;
                    };
                }
            }(this));
            return this;
        }
        
        itself.createCountdown = function (event, count, wait) {
            var c = Number(count);
            if (isNaN(c) || !isFinite(c) || c < 1) c = 1;
            var w = Number(wait);
            if (wait == null || isNaN(w) || !isFinite(w) || w < 0) w = 1000 * 5;
            
            return new Countdown(event, c, w);
        };
        
        itself.createEmitter = createEmitter;
        
        return itself;
    }());
    
    var cj = {
        version: version,
        
        isOwn: isOwn,
        
        cover: function (code, runner, options, onComplete) {
            var inst = new Coveraje(code, runner, options);
            
            if (inst.isInitialized) {
                if (typeof onComplete === "function") {
                    inst.onComplete(onComplete);
                }
                
                inst.start();
            }
        },
        
        // helper for test runners
        runHelper: runHelper
    };
    
    if (typeof exports == "object" && exports) {
        exports.coveraje = cj;
    }
    return cj;
}());