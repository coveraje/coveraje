/*
    coveraje - a simple javascript code coverage tool.
    
    nodeunit-specific helper
    --------------------------
    This helper supports the following options:
        reporter:           the reporter module to load (see https://github.com/caolan/nodeunit)
                            default: skip_passed
        reporterOptions:    the options for the reporter module
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
    See LICENSE in the root folder for more details.
*/

exports.run = function (file, event, option, requireSubst) {
    "use strict";
    var nodeunit;
    
    if (option == null) option = {};
    
    try {
        nodeunit = requireSubst("nodeunit");
    } catch (ex1) {
        event
            .error("<color yellow>nodeunit</color> not installed.")
            .complete();
        return;
    }
    
    var reporterName = option.reporter ? option.reporter : "skip_passed";
    var reporter = nodeunit.reporters[reporterName];
    if (reporter == null || typeof reporter.run !== "function") {
        event
            .error("nodeunit reporter <color yellow>" + reporterName + "</color> not found.")
            .complete();
        return;
    }
    
    try {
        reporter.run([file], option.reporterOptions, function () {
            event.complete();
        });
    } catch (ex2) {
        event.error(ex2).complete();
        return;
    }
};


