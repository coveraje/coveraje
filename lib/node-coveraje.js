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
                var visits = results.visits;
                var branches = results.branches;

                shell.writeLine("");
                shell.writeLine("         |  Items Tested | Coverage |");
                shell.writeLine("---------+---------------+----------+");
                if (visits.items > 0) {
                    shell.writeLine("Visits   |  <color bright white>%5d  %5d</color> |  <color bright white>%6s%</color> |", visits.items, visits.tested, visits.total);
                }

                if (results.branches.items > 0) {
                    shell.writeLine("Branches |  <color bright white>%5d  %5d</color> |  <color bright white>%6s%</color> |", branches.items, branches.tested, branches.total);
                }
                shell.writeLine("---------+---------------+----------+");

                if (visits.items > 0 || branches.items > 0) {
                    shell.writeLine("Total    |  <color bright white>%5d  %5d</color> |  <color bright white>%6s%</color> |", visits.items + branches.items, visits.tested + branches.tested, results.total);
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
