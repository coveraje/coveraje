/*
    coveraje - a simple javascript code coverage tool.

    common helper
    --------------------------
    loads a specific tdd framework helper if requested and runs the file

    Copyright (c) 2011-2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
    See LICENSE in the root folder for more details.
*/

(function () {
    "use strict";

    var helper = (function () {
        var requirePostfix = "$$_cj_inspected", // see Runtime.js
            path = require("path"),
            fs = require("fs"),
            Module = require("module");

        function requireSubst(self) {

            var req = function (m) {

                function compile(content, mod, filename, dirname) {
                    var Script = process.binding('evals').NodeScript;
                    var runInThisContext = Script.runInThisContext;

                    // create wrapper function
                    //
                    var wrapper = Module.wrap(content);

                    var compiledWrapper = runInThisContext(wrapper, filename, true);
                    var args = [mod.exports, requireSubst(mod), mod, filename, dirname];

                    return compiledWrapper.apply(mod.exports, args);
                }

                var pathToCode;
                pathToCode = Module._resolveFilename(m, self || module);
                if (Array.isArray(pathToCode)) pathToCode = pathToCode[1];

                var existsSync = fs.existsSync || path.existsSync;
                if (pathToCode != null && existsSync(pathToCode)) {
                    var code = fs.readFileSync(pathToCode, 'utf-8');

                    if (code.length > 1) {
                        if (code.substr(0, 2) === "#!") {
                            code = code.substr(code.indexOf("\n") + 1);
                        }
                    }

                    var filepath = path.resolve(pathToCode);
                    var dirname = path.dirname(filepath);
                    var cacheKey = filepath;

                    // test if there is a coveraje-injected version
                    var cachedModule = Module._cache[filepath + requirePostfix];
                    if (cachedModule) {
                        return cachedModule.exports;
                    }

                    cachedModule = Module._cache[filepath];
                    if (cachedModule) {
                        return cachedModule.exports;
                    }

                    var mod = new Module(filepath, module);
                    Module._cache[filepath] = mod;

                    mod.filename = filepath;
                    mod.paths = Module._nodeModulePaths(dirname);

                    compile(code, mod, filepath, dirname);

                    mod.loaded = true;

                    return mod.exports;
                }
                return require(m);
            };

            req.resolve = require.resolve;
            req.cache = require.cache;
            req.registerExtension = require.registerExtension;
            req.extensions = require.extensions;
            return req;
        }

        return {
            requireSubst: requireSubst
        };
    }());

    exports.run = function (testPath, framework, event, options) {

        var fwh;
        if (framework != null) {
            try {
                fwh = require("./" + framework);
            } catch (ex1) {
                event
                    .error("TDD framework helper '" + framework + "'\n" + ex1.message)
                    .complete();
                return;
            }
        }
        var fullPath = require("path").resolve(testPath);

        // hack: delete from cache if present
        if (fullPath in require.cache) delete require.cache[fullPath];

        var req = helper.requireSubst();
        if (fwh != null) {
            fwh.run(testPath, event, options, req);
        } else {
            var hasOnReady;
            try {
                var otc = req(fullPath).onTestComplete;
                if (typeof otc === "function") {
                    hasOnReady = true;
                    otc(function () {
                        event.complete();
                    });
                }
            } catch (ex2) {
                event.error(ex2);
            }
            if (!hasOnReady) {
                event.complete();
            }
        }
    };

}());
