/*
    coveraje - a simple javascript code coverage tool.
    
    mocha-specific helper
    --------------------------
    This helper supports the following options (quite the same as mocha(1)):
        require:            "name" or ["names"]         require the given module(s)
                            !!! path information differs here from mocha !!!
                                                        
        reporter:           "name"                      specify the reporter to use, default: dot
        ui:                 "name"                      specify user-interface (bdd|tdd|exports), default: bdd
        grep:               "pattern"                   only run tests matching pattern, default *
        timeout:            ms                          set test-case timeout in milliseconds, default 2000
        slow:               ms                          "slow" test threshold in milliseconds, default 75
        colors:             boolean                     force enabling/disabling of colors, default true
        bail:               boolean                     bail after first test failure, default false
        globals:            ["names"]                   allow the given global names
        ignoreLeaks:        boolean                     ignore flobal variable leaks, default false
    
    !!!!!!!!!!!
    - The options are likely to change with https://github.com/visionmedia/mocha/issues/265
    - mocha.opts and some options (like watch, growl, and debug) currently not supported
    
    Copyright (c) 2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
    See LICENSE in the root folder for more details.
*/

(function () {
    "use strict";
    
    function get(opt, name, defaultValue, list, event) {
        if (opt != null) {
            var orgOpt = opt;
            
            opt = ("" + opt).toLowerCase();

            opt = Object.keys(list).filter(function (v) {
                return v.toLowerCase() === opt;
            })[0];

            if (opt == null) {
                event
                    .error("mocha " + name + " <color yellow>" + orgOpt + "</color> not found.")
                    .complete();
                return null;
            }
        }
        if (opt == null) opt = defaultValue;
        return list[opt];
    }
    
    exports.run = function (file, event, option, requireSubst) {
        if (option == null) option = {};
        
        var mocha = option._mocha;
        if (mocha == null) {
            try {
                mocha = requireSubst("mocha");
            } catch (ex1) {
                event
                    .error("<color yellow>mocha</color> not installed.")
                    .complete();
                return;
            }
        }
        // hopefully, https://github.com/visionmedia/mocha/issues/265 makes it somewhat easier
        
        var Reporter = get(option.reporter, "reporter", "Dot", mocha.reporters, event);
        if (Reporter == null) return;
        
        var context = new mocha.Context();
        var suite = new mocha.Suite("root", context);
        
        var intf = get(option.ui, "interface", "bdd", mocha.interfaces, event);
        if (intf == null) return;
        
        intf(suite);
        
        if (option.colors != null) {
            mocha.reporters.Base.useColors = !!option.colors;
        }
        if (option.slow != null) {
            mocha.reporters.Base.slow = parseInt(option.slow, 10);
        }
        if (option.timeout != null) {
            suite.timeout(parseInt(option.timeout, 10));
        }
        suite.bail(!!option.bail);
        
        
        // require
        
        var path = require('path'),
            cwd = process.cwd();
        
        module.paths.push(cwd, path.join(cwd, 'node_modules'));
        if (option.require != null) {
            var req = option.require;
            if (typeof req === "string") {
                req = [req];
            }
            if (Array.isArray(req)) {
                for (var i = 0, il = req.length; i < il; i++) {
                    require(req[i]);
                }
            }
        }
        
        // load
        suite.emit('pre-require', global, file);
        suite.emit('require', requireSubst(path.join(cwd, file)), file);
        suite.emit('post-require', global, file);
        
        // run
        suite.emit('run');
        
        var runner = new mocha.Runner(suite);
        var reporter = new Reporter(runner);
        
        if (option.globals != null && Array.isArray(option.globals)) {
            runner.globals(option.globals);
        }
        if (option.ignoreLeaks != null) {
            runner.ignoreLeaks = !!option.ignoreLeaks;
        }
        if (option.grep != null) {
            runner.grep(new RegExp(option.grep));
        }
        
        runner.run(function () {
            event.complete();
            // HACK for mocha <= v0.12.1
            // remove all uncaughtException-listeners
            process.removeAllListeners('uncaughtException');
        });
    };
    
}());
