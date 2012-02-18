(function () {
    "use strict";
    
    suite('runHelper-emitter', function () {
        var runHelper = require("../../lib/runHelper").runHelper;
        
        suite('createEmitter()', function () {
            test('should create an event emitter', function (done) {
                var counter = 0;
                var e = runHelper.createEmitter(function () {
                    counter++;
                }).onComplete(function () {
                    if (counter === 1) done();
                })
                .onError(function () {
                    throw new Error("onError reached");
                });
                
                e.start();
                e.complete();
            });
        });
        
        
        suite('createCountdown()', function () {
            test('should create a countdown event emitter', function (done) {
                var e = runHelper.createEmitter(function () {})
                    .onComplete(function () {
                        done();
                    })
                    .onError(function () {
                        throw new Error("onError reached");
                    });
                
                var cd = runHelper.createCountdown(e, 5, 20);
                
                cd.one();
                cd.one();
                cd.one();
                cd.one();
                cd.one();
                // subsequent calls are ignored..
                cd.one();
                cd.one();
                cd.one();
                cd.one();
                cd.one();
                cd.one();
                cd.one();
            });
        });
        
        suite('createCountdown(wait)', function () {
            test('should raise error after x milliseconds', function (done) {
                var isDone;
                var e = runHelper.createEmitter(function () {})
                    .onComplete(function () {
                        if (!isDone) throw new Error("onComplete reached");
                    })
                    .onError(function () {
                        isDone = true;
                        done();
                    });
                
                var cd = runHelper.createCountdown(e, 5, 20);
                
                cd.one();
                cd.one();
                cd.one();
                cd.one();
            });
        });
        
        suite('createCountdown()', function () {
            test('should work with invalid counter', function (done) {
                var e = runHelper.createEmitter(function () {})
                    .onComplete(function () {
                        done();
                    })
                    .onError(function () {
                        throw new Error("onError reached");
                    });
                
                var cd = runHelper.createCountdown(e, -5, 20);
                
                cd.one();
            });
        });
        
    });
    
}());