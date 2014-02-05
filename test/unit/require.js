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

        test('relative path (resolveRequired)', function (done) {
            coveraje.cover(
                "var foo = require('./helper/require_relative1.js')",
                function (context, inst) {
                    if (context.foo === "test") done();
                },
                {
                    globals: "node",
                    quiet: true,
                    resolveRequired: ["*"]
                }
            );
        });

        test('npm installed', function (done) {
            coveraje.cover(
                "var foo = require('jshint')",
                function (context, inst) {
                    if (context.foo.JSHINT != null) done();
                },
                {
                    globals: "node",
                    quiet: true
                }
            );
        });

        test('npm installed (resolveRequired)', function (done) {
            coveraje.cover(
                "var foo = require('jshint')",
                function (context, inst) {
                    if (context.foo.JSHINT != null) done();
                },
                {
                    globals: "node",
                    quiet: true,
                    resolveRequired: ["*"]
                }
            );
        });
    });


}());
