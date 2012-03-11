(function () {
    "use strict";
    var coveraje = require('../..');

    suite('exports', function () {
        test('exports points to module.exports', function (done) {
            coveraje.cover(
                "\
exports.a = 1;\n\
exports.b = 2;\n\
module.exports.a = 11;\n\
module.exports.b = 12;\n\
module.exports.c = 13;\n\
module.exports.d = 14;\n\
exports.c = 3;\n\
",
                function (context, inst) {
                    context.exports.e = 1;
                    context.module.exports.f = 2;
                    if (
                        context.exports.a === 11 &&
                        context.exports.b === 12 &&
                        context.exports.c === 3 &&
                        context.exports.d === 14 &&

                        context.module.exports.a === 11 &&
                        context.module.exports.b === 12 &&
                        context.module.exports.c === 3 &&
                        context.module.exports.d === 14 &&

                        context.module.exports.e === 1 &&
                        context.exports.f === 2
                    ) done();
                },
                {
                    globals: "node",
                    quiet: true
                }
            );
        });
    });
}());
