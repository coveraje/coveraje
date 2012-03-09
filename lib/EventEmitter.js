/*
    coveraje - a simple javascript code coverage tool.

    EventEmitter wrapper

    Copyright (c) 2011-2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

(function () {
    "use strict";

    var EventEmitter = require("events").EventEmitter;

    function CoverajeEvent() {
        var ev = new EventEmitter();

        function emit(t) {
            return function () {
                var args = Array.prototype.slice.call(arguments, 0);
                ev.emit.apply(ev, [t].concat(args));
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
    }

    if (typeof module !== "undefined") {
        module.exports = CoverajeEvent;
    }
}());
