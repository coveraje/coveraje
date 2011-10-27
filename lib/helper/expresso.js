/*
    coveraje - a simple javascript code coverage tool.
    
    expresso-specific helper
    --------------------------
    It modifies the expresso source code on the fly (not permanent).
    This could lead to error's in future versions of expresso (or older ones that I have overseen).
    Please report bugs as soon as possible...
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
    See LICENSE in the root folder for more details.
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

exports.run = function (file, event) {
    "use strict";
    
    var fs = require("fs");
    var expresso;

    try {
        expresso = require.resolve("expresso");
    } catch (ex) {
        event.error("<color yellow>expresso</color> not installed.").complete();
        return;
    }
    
    fs.readFile(expresso, 'utf-8', function (experr, expdata) {
        if (experr) {
            event.error("<color yellow>expresso</color> not installed.").complete();
            return;
        }

        if (expdata.substr(0, 2) === "#!") {
            expdata = expdata.substr(expdata.indexOf("\n") + 1);
        }
        
        var m = expdata.match(/\n(?:if \(!defer\))/);
        if (m && m.index !== -1) {
            expdata = expdata.substr(0, m.index);
        }
        
        var vm = require("vm");
        var x = vm.createScript(expdata, "expresso");
        var ctx = vm.createContext({
            require: require,
            process: process,
            console: console
        });
        
        // hack: simulate console run
        ctx.process.argv = ["node", "expresso", "--boring"];
        
        x.runInNewContext(ctx);
        
        if (file.substr(0, 1) !== "/") {
            file = require("path").resolve(file);
        }
        
        if (file.substr(0, 1) === "/") {
            // expresso uses process.cwd() + filename
            file = "/" + new Array(process.cwd().split(/\//g).length).join("../") + file;
        }
        
        var rf;
        if (typeof ctx.runFiles === "function") {
            rf = ctx.runFiles;
            file = [file];
        } else if (typeof ctx.runFile === "function") {
            rf = ctx.runFile;
        } else if (typeof ctx.run === "function") {
            rf = ctx.run;
            file = [file];
        } else {
            event.error("Neither runFiles(), runFile(), nor run() found in expresso").complete();
            return;
        }
        
        // prevent reports from output after process emits "exit"
        if (ctx.process != null) {
            ctx.process.removeAllListeners("exit");
            if (typeof ctx.orig !== "undefined") {
                ctx.process.emit = ctx.orig;
            }
        }
        
        try {
            rf(file);
        } catch (ex) {
            event.error(ex).complete();
            return;
        }
        
        // report failures
        if (typeof ctx.reportFailures !== "undefined") {
            ctx.reportFailures();
        }
        
        event.complete();
    });
};


