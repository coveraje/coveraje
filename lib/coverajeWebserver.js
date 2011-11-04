/*
    coveraje - a simple javascript code coverage tool.
    
    the webserver
    
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

(function () {
    "use strict";

    if (typeof exports !== undefined) {

        exports.coverajeWebserver = function (instance) {
            var coveraje = require("./coveraje.js").coveraje,
                uglifyjs = require("../deps/UglifyJS/uglify-js"),
                fs = require("fs"),
                path = require("path"),
                http = require("http"),
                url = require("url"),
                server,
                colors,
                option = instance.option;

            function writeString(data, res, status, contentType) {
                var headers = {};
                if (contentType) {
                    headers["Content-Type"] = contentType;
                }
                res.writeHead(status, headers);
                res.end(data);
            }
            
            function writeError(res, status, text) {
                instance.shell.writeLine(text);
                res.writeHead(status, text);
                res.end();
            }
            
            function writeFile(filename, res, contentType) {
                fs.readFile(path.resolve(__dirname, filename), function (err, data) {
                    if (err) {
                        writeError(res, 404, err);
                    } else {
                        writeString(data, res, 200, contentType);
                    }
                });
            }
            
            // colorize some of the tokens
            function colorizer(code) {
                var ret = {};
                var nexttoken = uglifyjs.parser.tokenizer(code);
                
                function color(type, pos, endpos) {
                    if (!(type in ret)) ret[type] = [];
                    ret[type].push({s: pos, e: endpos});
                }
                
                for (;;) {
                    var token = nexttoken();
                    var cs = token.comments_before;
                    
                    if (cs) {
                        var cl = cs.length;
                        for (var i = 0; i < cl; i++) {
                            color("comment", cs[i].pos, cs[i].endpos);
                        }
                    }
                    if (token.type === "eof") break;
                    
                    switch (token.type) {
                        /*jshint white: false*/
                        case "keyword":
                        case "string":
                        case "num":
                        case "regexp":
                            color(token.type, token.pos, token.endpos);
                            break;
                    }
                    
                }
                return ret;
            }
            
            function start() {
                server = http.createServer(function (req, res) {
                    var requrl = url.parse(req.url, true);
                    var runner = instance.runner,
                        code = instance.code,
                        result = instance.result,
                        runtime = instance.runtime;
                    

                    switch (requrl.pathname.toLowerCase()) {
                        /*jshint white: false*/
                        
                        case "/": // main
                            writeFile("../webserver/coveraje.html", res, "text/html");
                            break;

                        case "/coveraje.json": // options and results
                            runtime.reset();
                            var rk;
                            if (requrl.query) {
                                if (requrl.query.init) {
                                    // get initial values
                                    var runnerKeys = [];
                                    if (typeof runner !== "function") {
                                        for (var rx in runner) {
                                            if (coveraje.isOwn(runner, rx)) {
                                                runnerKeys.push(rx);
                                            }
                                        }
                                    }
                                    
                                    writeString(
                                        JSON.stringify({
                                            options: option,
                                            runner: runnerKeys,
                                            code: code,
                                            colors: colorizer(code)
                                        }),
                                        res, 200, "application/json"
                                    );
                                    break;
                                    
                                } else if (requrl.query.runnerid) {
                                    // run single test
                                    rk = requrl.query.runnerid;
                                    if (rk) {
                                        if (!coveraje.isOwn(runner, rk)) {
                                            writeError(res, 400, "Runner with id '" + rk + "' undefined");
                                            break;
                                        } else if (typeof runner[rk] !== "function") {
                                            writeError(res, 400, "Runner with id '" + rk + "' is not a function");
                                            break;
                                        }
                                    }
                                }
                            }

                            // run the test(s)
                            var r = instance.createRunner();
                            r.runTest(result, runner, rk)
                                .onError(function (key, msg) {
                                    instance.shell.writeLine("%s: <color bright white>%s</color>", key, msg);
                                })
                                .onComplete(function (key, context) {
                                    writeString(
                                        JSON.stringify(runtime.reportData()),
                                        res, 200, "application/json"
                                    );
                                })
                                .start();
                            break;

                        case "/coveraje.js":
                            writeFile("../webserver/coveraje.js", res, "application/javascript");
                            break;

                        case "/coveraje.css":
                            writeFile("../webserver/coveraje.css", res, "text/css");
                            break;

                        default:
                            res.writeHead(404);
                            res.end();
                            break;
                    }

                });

                server.listen(option.serverPort, option.serverHost);
                instance.shell.writeLine("Server running at <color bright white>http://%s:%d/</color>", option.serverHost, option.serverPort);
            }
        
            function stop() {
                if (server) {
                    server.stop();
                }
            }
            
            return {
                start: start,
                stop: stop
            };
        };
    }
}());