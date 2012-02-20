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
        
    var CoverajeEvent = require("./EventEmitter").CoverajeEvent,
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
            shell = require("./shell").createShell(option),
            parser = require("./parser").createParser(runtime, option);
        
        function createRunner() {
            return testRunner.runTest(codes["initial code"], runner);
        }
        
        function addCode(name, code) {
            if (codes[name] == null) {
                var prep = parser.prepare(code);
                var idx = Object.keys(codes).length;
                
                codes[name] = {
                    index: idx,
                    name: name,
                    skippedLines: prep.skippedLines,
                    code: prep.code,
                    codeToRun: parser.injector.parseAndInject(prep.code, idx)
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
