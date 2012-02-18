(function () {
    "use strict";
    
    suite('TimerProxy', function () {
        var CoverajeTimer = require("../../lib/TimerProxy").CoverajeTimer;
        var timerProxy = new CoverajeTimer();
        
        suite('stopTimers()', function () {
            test('should stop all timeouts/intervals', function (done) {
                setTimeout(function () {
                    done();
                }, 50);
                
                timerProxy.setTimeout(function () {
                    throw new Error("timer reached");
                }, 2);
                
                timerProxy.setInterval(function () {
                    throw new Error("interval reached");
                }, 2);
                
                timerProxy.stopTimers();
            });
        });
        
        suite('clearTimeout()', function () {
            test('should be stoppable', function (done) {
                setTimeout(function () {
                    done();
                }, 50);
                
                var to = timerProxy.setTimeout(function () {
                    throw new Error("timer reached");
                }, 2);
                
                timerProxy.clearTimeout(to);
            });
        });
        
        suite('clearInterval()', function () {
            test('should be stoppable', function (done) {
                setTimeout(function () {
                    done();
                }, 50);
                
                var iv = timerProxy.setInterval(function () {
                    throw new Error("interval reached");
                }, 2);
                
                timerProxy.clearInterval(iv);
            });
        });
        
        suite('setInterval()', function () {
            test('should work', function (done) {
                var isDone;
                setTimeout(function () {
                    if (!isDone) throw new Error("interval reached");
                }, 50);
                
                var iv = timerProxy.setInterval(function () {
                    isDone = true;
                    done();
                    timerProxy.clearInterval(iv);
                }, 2);
            });
        });
        
        suite('setTimeout()', function () {
            test('should work', function (done) {
                var isDone;
                setTimeout(function () {
                    if (!isDone) throw new Error("interval reached");
                }, 50);
                
                var iv = timerProxy.setTimeout(function () {
                    isDone = true;
                    done();
                }, 2);
            });
        });
    });
    
}());