(function () {
    "use strict";
    
    function start(path) {
        var r = require.resolve(__dirname + path);
        delete require.cache[r];
        require(r);
    }
    
    start("/unit/utils.js");
    start("/unit/runHelper.js");
    start("/unit/TimerProxy.js");
    start("/unit/report-helper.js");
}());


