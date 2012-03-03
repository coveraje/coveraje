/*
    coveraje - a simple javascript code coverage tool.
    
    utils
    ------------
    helper functions
    
    Copyright (c) 2011-2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

(function () {
    "use strict";

    //
    // helper for "hasOwnProperty"
    var hop = Object.prototype.hasOwnProperty;
    function isOwn(object, name) {
        return hop.call(object, name);
    }
    
    function doOptions(opts) {
        if (!opts) opts = {};
        for (var i = 1; i < arguments.length; i++) {
            var defOpts = arguments[i];
            if (typeof defOpts === "object") {
                for (var key in defOpts) {
                    if (isOwn(defOpts, key)) {
                        if (opts[key] == null) {
                            opts[key] = defOpts[key];
                        }
                    }
                }
            }
        }
        return opts;
    }
    
    if (typeof module !== "undefined") {
        module.exports = {
            isOwn: isOwn,
            doOptions: doOptions
        };
    }
}());