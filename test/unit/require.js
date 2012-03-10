(function () {
    "use strict";
    var coveraje = require('../..');
    var fs = require('fs');
    var path = require('path');

    suite('require', function () {
        test('relative path', function (done) {
            coveraje.cover(
                "var foo = require('./helper/require_relative1.js')",
                function (context, inst) {
                    if (context.foo === "test") done();
                },
                {
                    globals: "node",
                    quiet: true
                }
            );
        });

        test('relative path2', function (done) {
            coveraje.cover(
                fs.readFileSync(path.join(__dirname, 'helper', 'require_relative1.js'), 'utf-8'),
                function (context, inst) {
                    if (context.foo === "test") done();
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
