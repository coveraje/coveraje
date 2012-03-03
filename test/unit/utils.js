(function () {
    "use strict";
    var assert = require('assert');
    
    suite('utils', function () {
        var utils = require("../../lib/utils");
        
        suite('doOptions()', function () {
            test('should combine options from right to left', function () {
                var opts = utils.doOptions({a: 1, d: 1}, {a: 2, b: 2}, {a: 3, c: 3}, {a: 4, d: 4});
                
                opts.a.should.equal(1, "a");
                opts.b.should.equal(2, "b");
                opts.c.should.equal(3, "c");
                opts.d.should.equal(1, "d");
            });
            
            test('should return empty object', function () {
                var opts = utils.doOptions();
                assert.exist(opts);
            });
        });
        
        suite('isOwn()', function () {
            var o1 = {a: 1, b: 2};
            function O2() {
                this.c = 3;
                return this;
            }
            O2.prototype = o1;
            var o2 = new O2();
            var o3 = Object.create(o2);
            
            test('should return true if property is own property of object', function () {
                utils.isOwn(o1, "a").should.equal(true, "o1.a");
                utils.isOwn(o1, "b").should.equal(true, "o1.b");
                utils.isOwn(o1, "c").should.equal(false, "o1.c");
                utils.isOwn(o1, "d").should.equal(false, "o1.d");
            });
            
            test('should return true if property is own property of object (prototype)', function () {
                utils.isOwn(o2, "a").should.equal(false, "o2.a");
                utils.isOwn(o2, "b").should.equal(false, "o2.b");
                utils.isOwn(o2, "c").should.equal(true, "o2.c");
                utils.isOwn(o2, "d").should.equal(false, "o2.d");
            });
            
            test('should never return true (Object.create)', function () {
                utils.isOwn(o3, "a").should.equal(false, "o3.a");
                utils.isOwn(o3, "b").should.equal(false, "o3.b");
                utils.isOwn(o3, "c").should.equal(false, "o3.c");
                utils.isOwn(o3, "d").should.equal(false, "o3.d");
            });
        });
    });
    
}());