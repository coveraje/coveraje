/*
    coveraje - a simple javascript code coverage tool.
    
    common helper
    --------------------------
    loads a specific tdd framework helper if requested and runs the file
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
    See LICENSE in the root folder for more details.
*/

/*jshint
    node: true,
    white: true,
    eqnull: true,
    multistr: true,
    plusplus: false,
    regexp: true,
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

exports.run = function (testPath, framework, event, options) {
    "use strict";
    
    var fwh;
    if (framework != null) {
        try {
            fwh = require("./" + framework);
        } catch (ex1) {
            event.error("TDD framework helper ");
            //event.error("TDD framework helper " + framework + "\n" + ex1.message).complete();
            return;
        }
    }
    testPath = require("path").resolve(testPath);
    
    // hack: delete from cache if present
    if (testPath in require.cache) delete require.cache[testPath];
    
    if (fwh != null) {
        fwh.run(testPath, event, options);
    } else {
        try {
            require(testPath);
        } catch (ex2) {
            event.error(ex2);
        }
        event.complete();
    }
};