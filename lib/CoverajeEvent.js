/*
    coveraje - a simple javascript code coverage tool.
    
    EventEmitter wrapper
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
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

(function () {
    "use strict";
    
    var EventEmitter = require("events").EventEmitter;

    exports.CoverajeEvent = function (wait) {
        var ev = new EventEmitter();
        
        function emit(t) {
            return function () {
                var args = Array.prototype.slice.call(arguments, 0);
                try {
                    ev.emit.apply(ev, [t].concat(args));
                } catch (ex) {}
                return this;
            };
        }
        function on(t) {
            return function () {
                var args = Array.prototype.slice.call(arguments, 0);
                ev.on.apply(ev, [t].concat(args));
                return this;
            };
        }
        
        this.complete = emit("_cj_complete");
        this.error = emit("_cj_error"); // don't use special "error" event
        this.start = emit("_cj_start");
        
        this.onComplete = on("_cj_complete");
        this.onError = on("_cj_error");
        this.onStart = on("_cj_start");
        
        return this;
    };
}());