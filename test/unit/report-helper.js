(function () {
    "use strict";
    
    suite('report', function () {
        suite('helper', function () {
            suite('lineInfoFromPosition()', function () {
                var helper = require("../../lib/report").helper;
                var source1 = "\nhallo\nworld\na\ntest";
                var source2 = "\n\n\n ";
                
                test('should return the correct values 0', function () {
                    var li = helper.lineInfoFromPosition(0, source1);
                    li.line.should.equal(0, "line");
                    li.pos.should.equal(0, "pos");
                    li.source.should.equal("", "source");
                });
                
                test('should return the correct values 1', function () {
                    var li = helper.lineInfoFromPosition(1, source1);
                    li.line.should.equal(1, "line");
                    li.pos.should.equal(0, "pos");
                    li.source.should.equal("hallo", "source");
                });
                
                test('should return the correct values 18', function () {
                    var li = helper.lineInfoFromPosition(18, source1);
                    li.line.should.equal(4, "line");
                    li.pos.should.equal(3, "pos");
                    li.source.should.equal("test", "source");
                });
                
                //
                test('should return the correct values on empty lines 0', function () {
                    var li = helper.lineInfoFromPosition(0, source2);
                    li.line.should.equal(0, "line");
                    li.pos.should.equal(0, "pos");
                    li.source.should.equal("", "source");
                });
                
                test('should return the correct values on empty lines 1', function () {
                    var li = helper.lineInfoFromPosition(1, source2);
                    li.line.should.equal(1, "line");
                    li.pos.should.equal(0, "pos");
                    li.source.should.equal("", "source");
                });
                
                test('should return the correct values on empty lines 2', function () {
                    var li = helper.lineInfoFromPosition(2, source2);
                    li.line.should.equal(2, "line");
                    li.pos.should.equal(0, "pos");
                    li.source.should.equal("", "source");
                });
                
                test('should return the correct values on empty lines 3', function () {
                    var li = helper.lineInfoFromPosition(3, source2);
                    li.line.should.equal(3, "line");
                    li.pos.should.equal(0, "pos");
                    li.source.should.equal(" ", "source");
                });
                
                test('should return the correct values on empty lines 4', function () {
                    var li = helper.lineInfoFromPosition(4, source2);
                    li.line.should.equal(3, "line");
                    li.pos.should.equal(1, "pos");
                    li.source.should.equal(" ", "source");
                });
                
                test('should return last position if position > length', function () {
                    var li = helper.lineInfoFromPosition(5, source2);
                    li.line.should.equal(3, "line");
                    li.pos.should.equal(1, "pos");
                    li.source.should.equal(" ", "source");
                });
                
            });
        });
    });
    
}());