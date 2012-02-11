/*
    coveraje - a simple javascript code coverage tool.
    
    entry point for node
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

var coveraje = (function () {
    "use strict";
    
    var uglifyjs = require("uglify-js"),
        CoverajeEvent = require("./EventEmitter").CoverajeEvent,
        Coveraje = require("./core").Coveraje,
        coverajeWebserver = require("./webserver").coverajeWebserver,
        utils = require("./utils").utils,
        runHelper = require("./runHelper").runHelper;
        
    var isOwn = utils.isOwn;
    
    function runInConsole(options, instance) {
        var hasError = false;
        var mr = instance.createRunner();
        var runtime = instance.runtime;
        var shell = require("./shell").createShell(utils.doOptions(options, Coveraje.defaultOptions));
        
        mr
            .onComplete(function (key, context) {
                var results = runtime.getResults();
                var visited = results.visited;
                var branches = results.branches;
                var total = results.total;

                
                var div = "---------+---------------+----------+";
                var frmt = "|  <color bright white>%5d  %5d</color> |  <color bright white>%6s%</color> |";
                
                shell.writeLine("");
                shell.writeLine("         |  Items Tested | Coverage |");
                shell.writeLine(div);
                
                if (visited != null && visited.items > 0) {
                    shell.writeLine("Visits   " + frmt, visited.items, visited.tested, visited.coverage.toFixed(2));
                }

                if (results != null && results.branches.items > 0) {
                    shell.writeLine("Branches " + frmt, branches.items, branches.tested, branches.coverage.toFixed(2));
                }

                if (total != null && total.areas > 1) {
                    shell.writeLine(div);
                    shell.writeLine("Total    " + frmt, total.items, total.tested, total.coverage.toFixed(2));
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
    
    var cj = {
        version: Coveraje.version,
        
        cover: function (code, runner, options, onComplete) {
            if (coverajeWebserver.handles(options)) {
                coverajeWebserver
                    .create(code, runner, options, onComplete)
                    .start();
            } else {
                var inst = new Coveraje(code, runner, options);
                
                if (inst.isInitialized) {
                    if (typeof onComplete === "function") {
                        inst.onComplete(onComplete);
                    }
                    runInConsole(options, inst);
                }
            }
        },
        
        // helper for test runners
        runHelper: runHelper
    };
    
    if (typeof exports !== "undefined" && exports) {
        exports.coveraje = cj;
    }
    return cj;
}());
