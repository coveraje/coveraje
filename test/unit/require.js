(function () {
    "use strict";
    var coveraje = require('../..');

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
