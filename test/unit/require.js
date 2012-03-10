(function () {
    "use strict";
    var coveraje = require('../..');
    var fs = require('fs');
    var path = require('path');

    suite('require', function () {
        test('relative path2', function (done) {
            coveraje.cover(
                path.join(__dirname, 'helper', 'require_relative1.js'),
                function (context, inst) {
                    if (context.module.exports === "test") done();
                },
                {
                    globals: "node",
                    quiet: true
                },
                function () { },
                function (e, err) {
                  throw e || err;
                }
            );
        });
    });


}());
