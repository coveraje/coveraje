/*
    coveraje - a simple javascript code coverage tool.
    
    parser/modifier
    
    Copyright (c) 2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

(function () {
    "use strict";
    
    var esprima = require("esprima");
    var escodegen = require("escodegen");
    var endposDelta = 1; // in esprima, the range for "a" is [0, 0], "aa" is [0, 1]...
    
    function walkAll(ast, callbacks) {
        // all walkable properties of the node types
        var walk_properties = {
            AssignmentExpression: ["left", "right"],
            ArrayExpression: ["elements"],
            BlockStatement: ["body"],
            BinaryExpression: ["left", "right"],
            BreakStatement: null,
            CallExpression: ["callee", "arguments"],
            CatchClause: ["body"],
            ConditionalExpression: ["test", "consequent", "alternate"],
            ContinueStatement: null,
            DoWhileStatement: ["test", "body"],
            DebuggerStatement: null,
            EmptyStatement: null,
            ExpressionStatement: ["expression"],
            ForStatement: ["init", "test", "update", "body"],
            ForInStatement: ["left", "right", "body"],
            FunctionDeclaration: ["body"],
            FunctionExpression: ["body"],
            Identifier: null,
            IfStatement: ["test", "consequent", "alternate"],
            Literal: null,
            LabeledStatement: ["body"],
            LogicalExpression: ["left", "right"],
            MemberExpression: ["object", "property"],
            NewExpression: ["callee", "arguments"],
            ObjectExpression: ["properties"],
            Program: ["body"],
            Property: ["value"],
            ReturnStatement: ["argument"],
            SequenceExpression: ["expressions"],
            SwitchStatement: ["discriminant", "cases"],
            SwitchCase: ["test", "consequent"],
            ThisExpression: null,
            ThrowStatement: ["argument"],
            TryStatement: ["block", "handlers", "finalizer"],
            UnaryExpression: ["argument"],
            UpdateExpression: ["argument"],
            VariableDeclaration: ["declarations"],
            VariableDeclarator: ["init"],
            WhileStatement: ["test", "body"],
            WithStatement: ["object", "body"]
        };
        
        // walk the tree
        function walk(ast, callbacks, parent, prop, useParent) {
            if (ast == null) {
                return;
            }
            
            if (Array.isArray(ast)) {
                for (var i = 0, il = ast.length; i < il; i++) {
                    walk(ast[i], callbacks, ast, i, useParent);
                }
                return;
            }
            if (typeof ast !== "object") {
                return;
            }
            var cb = callbacks[ast.type];
            if (typeof cb === "function") {
                if (ast.range != null) { // coveraje specific
                    var result = cb(ast, useParent);
                    useParent = parent;
                    
                    if (result != null) {
                        if (result.replace != null && parent != null) {
                            parent[prop] = result.replace;
                        }
                        if (result.useParent != null) {
                            useParent = result.useParent;
                        }
                    }
                } else {
                    useParent = parent;
                }
            }
            
            var walkTo = walk_properties[ast.type];
            if (Array.isArray(walkTo)) {
                walkTo.forEach(function (key) {
                    if (ast[key] != null) {
                        walk(ast[key], callbacks, ast, key, useParent);
                    }
                });
            }
        }
        
        return walk(ast, callbacks);
    }
    
    function markDeclarations(body) {
        for (var i = 0, il = body.length; i < il; i++) {
            var stmt = body[i];
            
            if (stmt.type === 'ExpressionStatement' &&
                stmt.expression.type === 'Literal' &&
                typeof stmt.expression.value === 'string') {
                // directive
                stmt.expression.cj_isDirective = true;
            } else {
                return i;
            }
        }
        return 0;
    }
    
    function flatSplice(array, position, insert) {
        if (insert == null || !Array.isArray(insert) || insert.length === 0) return array;
        
        if (position === 0) {
            return insert.concat(array);
        } else {
            return array.slice(0, position)
                .concat(insert)
                .concat(array.slice(position))
            ;
        }
    }
    
    //
    // ast manipulation
    var exp_left = {
        AssignmentExpression: "left",
        ArrayExpression: function (node) {
            return [node.range[0], node.range[0] + 1 - endposDelta];
        },
        BinaryExpression: "left",
        CallExpression: "callee",
        ConditionalExpression: "test",
        ExpressionStatement: "expression",
        FunctionExpression: false,
        Identifier: null,
        Literal: null,
        LogicalExpression: "left",
        MemberExpression: "object",
        NewExpression: "callee",
        ObjectExpression: function (node) {
            return [node.range[0], node.range[0] + 1 - endposDelta];
        },
        SequenceExpression: function (node) {
            return node.expressions[0];
        },
        ThisExpression: null,
        UnaryExpression: "argument",
        UpdateExpression: "argument"
    };
    
    function leftName(node) {
        function leftAct(nt) {
            if (nt === null) {
                return node;
            } else if (nt === false) {
                return null;
            } else if (typeof nt === "undefined") {
                return null;
            } else if (typeof nt === "string") {
                return leftName(node[nt]);
            } else if (typeof nt === "function") {
                return leftAct(nt(node));
            } else if (Array.isArray(nt)) {
                return {range: nt};
            } else if (nt.type != null) {
                return leftName(nt);
            }
            return null;
        }
        
        return leftAct(exp_left[node.type]);
    }
    
    function asStmt(expr) {
        return {
            type: "ExpressionStatement",
            expression: expr
        };
    }
    
    function asBlock(stmt) {
        var args = Array.prototype.slice.call(arguments).filter(function (arg) {
            return arg != null;
        });
        
        if (stmt != null && stmt.type === "BlockStatement") {
            if (args.length > 1) {
                stmt.body = flatSplice(args.slice(1), stmt.body);
            }
            return stmt;
        }
        return {
            type: "BlockStatement",
            body: args
        };
    }
    
    function isSimple(node) {
        return node.type === "Identifier" ||
                node.type === "Literal";
    }
    
    function init(instance) {
        var option = instance.options;
        var runtime = instance.runtime;
        
        function callRuntime(type, member, args) {
            
            function argToType(arg) {
                if (arg.type != null) return arg;
                
                if (Array.isArray(arg)) {
                    return {
                        type: "ArrayExpression",
                        elements: argsToTypes(arg)
                    };
                }
                
                if (typeof arg === "string" || typeof arg === "number") {
                    return {
                        type: "Literal",
                        value: arg
                    };
                }
                
                return {
                    type: "ObjectExpression",
                    properties: Object.keys(arg).map(function (key) {
                        return {
                            type: "Property",
                            kind: "init",
                            key: {
                                type: "Literal",
                                value: key
                            },
                            value: argToType(arg[key])
                        };
                    })
                };
            }
            
            function argsToTypes(args) {
                return args.map(argToType);
            }
            
            return {
                type: "CallExpression",
                callee: {
                    type: "MemberExpression",
                    computed: false,
                    object: {
                        type: "MemberExpression",
                        computed: false,
                        object: {
                            type: "Identifier",
                            name: option.prefix + "runtime"
                        },
                        property: {
                            type: "Identifier",
                            name: type
                        }
                    },
                    property: {
                        type: "Identifier",
                        name: member
                    }
                },
                "arguments": argsToTypes(args)
            };
        }
        
        //
        // inject everything needed for code coverage
        function ast_inject(ast, code, key) {
            
            function visitFunction(colorize, params) {
                var ret = [
                    visit(null, colorize)
                ];
                
                var il = params.length;
                if (il > 0) {
                    var paramsPosition = params.map(function (param) {
                        var r = param.range;
                        runtime.visits.register(key, r[0], r[1] + endposDelta);
                        return {
                            pos: r[0],
                            endpos: r[1] + endposDelta
                        };
                    });
                    
                    var args = [
                        key,
                        {
                            type: "Identifier",
                            name: "arguments"
                        },
                        paramsPosition
                    ];
                    ret.push(
                        asStmt(
                            callRuntime("visits", "funcargs", args)
                        )
                    );
                }
                
                return ret;
            }
            
            function visit(ret, colorize) {
                if (colorize == null) colorize = ret;
                if (colorize != null && colorize.range != null) {
                    var r = colorize.range;
                    
                    if (runtime.visits.register(key, r[0], r[1] + endposDelta)) {
                        var stmt = asStmt(callRuntime("visits", "call", [key, r[0], r[1] + endposDelta]));
                        
                        if (ret == null) {
                            return stmt;
                        } else {
                            return asBlock(stmt, ret);
                        }
                    }
                }
                return ret;
            }
            
            function visit_ret(ret, colorize) {
                if (colorize != null) {
                    var r = colorize.range;
                    if (r != null && runtime.visits.register(key, r[0], r[1] + endposDelta)) {
                        return callRuntime("visits", "callWithRet", [key, ret, r[0], r[1] + endposDelta]);
                    }
                }
                return ret;
            }
            
            function visit_ret_simple(node) {
                if (node != null) {
                    if (isSimple(node)) {
                        return visit_ret(node, node);
                    } else if (node.type === "BinaryExpression") {
                        if (isSimple(node.left) && isSimple(node.right)) {
                            return visit_ret(node, node);
                        } else {
                            var idx = code.indexOf(node.operator, node.left.range[1] + endposDelta);
                            if (idx !== -1 && idx < node.right.range[0]) {
                                var op = {range: [idx, idx + node.operator.length - endposDelta]};
                                return visit_ret(node, op);
                            }
                        }
                    }
                }
                return node;
            }
            
            function visit_ret_if(node) {
                if (node.range != null) {
                    if (node.type === "LogicalExpression") {
                        node.left = visit_ret_if(node.left);
                        node.right = visit_ret_if(node.right);
                    } else /*if (isSimple(node))*/ {
                        return visit_retIfTrue(node);
                    }
                }
                return node;
            }
            
            function visit_retIfTrue(node) {
                var r = node.range;
                if (r != null && runtime.visits.register(key, r[0], r[1] + endposDelta)) {
                    return callRuntime("visits", "callWithRetIfTrue", [key, node, r[0], r[1] + endposDelta]);
                }
                return node;
            }
            
            function addBranch(main, colorize, isDefault, ret) {
                var mr = main.range;
                var cr = colorize.range;
                
                runtime.branches.register(key, mr[0], mr[1] + endposDelta, cr[0], cr[1] + endposDelta, isDefault);
                if (ret != null) {
                    return callRuntime("branches", "callWithRet", [key, ret, mr[0], mr[1] + endposDelta, cr[0], cr[1] + endposDelta]);
                } else {
                    return asStmt(callRuntime("branches", "call", [key, mr[0], mr[1] + endposDelta, cr[0], cr[1] + endposDelta]));
                }
            }
            
            function branchTesterName(keywordPos, keywordEndpos) {
                return option.prefix + "branch_" + keywordPos + "_" + keywordEndpos;
            }
            
            var ws = {
                AssignmentExpression: function (node) {
                    node.right = visit_ret(node.right, leftName(node.left));
                },
                BreakStatement: function (node) {
                    return {
                        replace: visit(node, {range: [node.range[0], node.range[0] + 5 - endposDelta]})
                    };
                },
                ConditionalExpression: function (node) {
                    var idx = code.indexOf("?", node.test.range[1]);
                    if (idx !== -1 && idx < node.consequent.range[0]) {
                        var questionMark = {range: [idx, idx + 1 - endposDelta]};
                        
                        idx = code.indexOf(":", node.consequent.range[1]);
                        if (idx !== -1 && idx < node.alternate.range[0]) {
                            var colon = {range: [idx, idx + 1 - endposDelta]};
                            
                            node.consequent = addBranch(questionMark, questionMark, false, node.consequent);
                            node.alternate = addBranch(questionMark, colon, true, node.alternate);
                        }
                    }
                },
                ContinueStatement: function (node) {
                    return {
                        replace: visit(node, {range: [node.range[0], node.range[0] + 8 - endposDelta]})
                    };
                },
                DoWhileStatement: function (node) {
                    var bracket;
                    var idx = code.indexOf("{", node.range[0] + 2);
                    
                    if (idx !== -1 && idx <= node.body.range[0]) {
                        bracket = {range: [idx, idx + 1 - endposDelta]};
                    } else {
                        // it's also possible to have a do..while statement
                        // without a block
                        // do
                        //     statement;
                        // while(false);
                        
                        // mark "do"-keyword in these cases
                        bracket = {range: [node.range[0], node.range[0] + 2 - endposDelta]};
                    }
                    node.body = asBlock(visit(null, bracket), node.body);
                    node.test = visit_ret_if(node.test);
                },
                ExpressionStatement: function (node) {
                    if (!node.cj_isDirective) {
                        if (
                            node.expression.type === "MemberExpression" ||
                            node.expression.type === "NewExpression" ||
                            node.expression.type === "ThisExpression" ||
                            node.expression.type === "UnaryExpression" ||
                            (
                                node.expression.type === "CallExpression" &&
                                node.expression.callee.type !== "FunctionExpression"
                            )
                        ) {
                            
                            return {
                                replace: visit(node, leftName(node))
                            };
                        
                        }
                    }
                },
                ForStatement: function (node) {
                    var lst = node.update || node.test || node.init;
                    var idx;
                    if (lst == null) {
                        // for (;;)
                        idx = code.indexOf(")", node.range[0] + 4 + endposDelta);
                    } else {
                        idx = code.indexOf(")", lst.range[1] + endposDelta);
                    }
                    if (idx !== -1 && idx < node.body.range[0]) {
                        var lastParen = {range: [idx, idx + 1 - endposDelta]};
                        node.body = asBlock(visit(null, lastParen), node.body);
                    }
                    
                    node.test = visit_ret_simple(node.test);
                },
                ForInStatement: function (node) {
                    var idx = code.indexOf(")", node.right.range[1] + endposDelta);
                    if (idx !== -1 && idx < node.body.range[0]) {
                        var lastParen = {range: [idx, idx + 1 - endposDelta]};
                        node.body = asBlock(visit(null, lastParen), node.body);
                    }
                },
                FunctionDeclaration: function (node) {
                    var c = markDeclarations(node.body.body);
                    var funcKeyword = {
                        range: [node.range[0], node.range[0] + 8 - endposDelta]
                    };
                    
                    node.body.body = flatSplice(
                        node.body.body,
                        c,
                        visitFunction(funcKeyword, node.params)
                    );
                },
                FunctionExpression: function (node) {
                    var c = markDeclarations(node.body.body);
                    
                    if (code.substr(node.range[0], 1) === "f") {
                        var funcKeyword = {
                            range: [node.range[0], node.range[0] + 8 - endposDelta]
                        };
                        
                        node.body.body = flatSplice(
                            node.body.body,
                            c,
                            visitFunction(funcKeyword, node.params)
                        );
                    } // TODO: colorize "get prop() {}"
                },
                IfStatement: function (node) {
                    var r = node.range, idx;
                    var ncr = node.consequent.range;
                    
                    var ifKeyword = {range: [r[0], r[0] + 2 - endposDelta]};
                    
                    var elseKeyword = {range: [0, 0 - endposDelta]};
                    if (node.alternate != null) {
                        r = node.alternate.range;
                        
                        idx = code.lastIndexOf("else", r[0]); // else keyword not exposed by the parser
                        if (idx !== -1 && idx > ncr[1] + endposDelta) {
                            elseKeyword = {range: [idx, idx + 4 - endposDelta]};
                        }
                    }
                    
                    r = node.test.range;
                    
                    // use first opening parenthesis to indicate how often the if block is executed
                    var firstParen;
                    idx = code.indexOf("(", node.range[0] + 2);
                    if (idx !== -1 && idx < r[0]) {
                        firstParen = {range: [idx, idx]};
                    }
                    
                    // since the closeing parenthesis of the if statement is the only thing
                    // that is always there (beside "if" itself), use this to indicate how
                    // many times the consequent-part is executed
                    var lastParen = {range: [0, 0 - endposDelta]};
                    idx = code.indexOf(")", r[1] + endposDelta);
                    if (idx !== -1 && idx < ncr[0]) {
                        lastParen.range = [idx, idx];
                    }
                    
                    node.consequent = asBlock(node.consequent);
                    node.consequent.body.splice(0, 0, addBranch(ifKeyword, lastParen));
                    
                    node.alternate = asBlock(node.alternate);
                    node.alternate.body.splice(0, 0, addBranch(ifKeyword, elseKeyword, true));
                    
                    node.test = visit_ret_if(node.test);
                    
                    if (firstParen != null) {
                        return {
                            replace: visit(node, firstParen)
                        };
                    }
                },
                Literal: function (node) {
                    // there's a bug in esprima <= 0.9.9-dev
                    // null is not stored as null, but as "null" (string)
                    if (node.range[1] - node.range[0] === 4 - endposDelta) {
                        if (node.value === "null") {
                            node.value = null;
                        }
                    }
                },
                LogicalExpression: function (node) {
                    visit_ret_if(node);
                },
                Program: function (node) {
                    markDeclarations(node.body);
                },
                ReturnStatement: function (node) {
                    return {
                        replace: visit(node, {range: [node.range[0], node.range[0] + 6 - endposDelta]})
                    };
                },
                SwitchStatement: function (node) {
                    var hasDefault = false;
                    if (node.cases != null) {
                        if (node.cases.length > 0 && node.cases[node.cases.length - 1].test == null) {
                            hasDefault = true;
                        }
                    } else {
                        node.cases = [];
                    }
                    
                    if (!hasDefault) {
                        // no default block found
                        node.cases.push({
                            type: "SwitchCase",
                            test: null,
                            consequent: [],
                            range: [0, 0]
                        });
                    }
                    
                    var name = option.prefix + "branch_" + node.range[0];
                    var switchKeyword = {range: [node.range[0], node.range[0] + 6 - endposDelta]};
                    
                    node.discriminant = visit_ret_simple(node.discriminant);
                    
                    return {
                        replace: asBlock({
                            type: "VariableDeclaration",
                            kind: "var",
                            declarations: [{
                                type: "VariableDeclarator",
                                id: {
                                    type: "Identifier",
                                    name: name
                                },
                                init: {
                                    type: "Literal",
                                    value: true
                                }
                            }]
                        }, node),
                        useParent: switchKeyword
                    };
                },
                SwitchCase: function (node, switchKeyword) {
                    if (switchKeyword != null && switchKeyword.range != null) {
                        var pr = switchKeyword.range;
                        var name = option.prefix + "branch_" + pr[0];
                        
                        var isDefault = node.test == null;
                        var caseKeyword = {range: [0, 0 - endposDelta]};
                        
                        if (node.range[0] !== 0) {
                            var first = isDefault ? node.range[0] : node.test.range[0];
                            var idx = code.lastIndexOf(isDefault ? "default" : "case", first);
                            
                            if (idx !== -1 && idx > pr[1]) {
                                caseKeyword.range = [idx, idx + 4 - endposDelta + (isDefault ? 3 : 0)];
                            }
                        }
                        
                        node.consequent.splice(0, 0, {
                            type: "IfStatement",
                            test: {
                                type: "Identifier",
                                name: name
                            },
                            consequent: asBlock(
                                asStmt({
                                    type: "AssignmentExpression",
                                    operator: "=",
                                    left: {
                                        type: "Identifier",
                                        name: name
                                    },
                                    right: {
                                        type: "Literal",
                                        value: false
                                    }
                                }),
                                addBranch(switchKeyword, caseKeyword, isDefault)
                            )
                            } // jshint whitespace checking is wrong here...
                        );
                    }
                },
                ThrowStatement: function (node) {
                    return {
                        replace: visit(node, {range: [node.range[0], node.range[0] + 5 - endposDelta]})
                    };
                },
                TryStatement: function (node) {
                    return {
                        replace: visit(node, {range: [node.range[0], node.range[0] + 3 - endposDelta]})
                    };
                },
                UpdateExpression: function (node) {
                    if (isSimple(node.argument)) {
                        return {
                            replace: visit_ret(node, node)
                        };
                    }
                },
                VariableDeclarator: function (node) {
                    if (node.init != null) {
                        node.init = visit_ret(node.init, leftName(node.id));
                    }
                },
                WhileStatement: function (node) {
                    var idx = code.indexOf(")", node.test.range[1] + endposDelta);
                    if (idx !== -1 && idx < node.body.range[0]) {
                        var lastParen = {range: [idx, idx + 1 - endposDelta]};
                        node.body = asBlock(visit(null, lastParen), node.body);
                    }
                    
                    node.test = visit_ret_if(node.test);
                }
            };
            
            if (option.resolveRequires.length > 0) {
                ws.CallExpression = function (node) {
                    if (node.callee.type === "Identifier" && node.callee.name === "require") {
                        var args = node['arguments'];
                        if (args != null && args.length === 1) {
                            args.push({
                                type: "Identifier",
                                name: "module"
                            });
                            return {
                                replace: callRuntime("helper", "require", args)
                            };
                        }
                    }
                };
            }
            
            walkAll(ast, ws);
        }
        
        //
        // parses the code, inject the needed statements and return generated code
        function parseAndInject(code, key) {
            var ast;
            try {
                ast = esprima.parse(code, {range: true});
            } catch (ex) {
                throw ex;
            }
            runtime.init(key);
            ast_inject(ast, code, key);
            
            var genopt = {
                indent: ""
            };
            if (option.beautify) {
                // also beautify generated code (e.g. for easier debug)
                genopt.indent = "    ";
            }
            return escodegen.generate(ast);
        }
        
        //
        // removes #! (shebang) in first line
        // removes \r from \r\n (easier to calculate positions)
        // removes first comments (better overview)
        function prepare(code) {
            var skippedLines = 0;
            code = code || "";
            
            if (option.stripSheBang && code.length > 1) {
                if (code.substr(0, 2) === "#!") {
                    code = code.substr(code.indexOf("\n") + 1);
                    skippedLines++;
                }
            }
            
            if (option.stripFirstComments) {
                code = code.replace(/^(?:\s*(?:(?:\/[*](?:[^*]|[*][^\/])*[*]\/)|(?:\/\/.*\n?)))+/, function (d) {
                    skippedLines += d.split("\n").length - 1;
                    return "";
                });
            }
            
            if (option.beautify) {
                try {
                    code = escodegen.generate(esprima.parse(code, {range: true}), {indent: "    "});
                } catch (ex) {
                }
            } else {
                code = code.replace(/\r(?=\n)/g, "").replace(/\r/g, "\n");
            }
            
            code = code.replace(/^([ \t]*\n)+/, function (d) {
                skippedLines += d.split("\n").length - 1;
                return "";
            });
            
            return {
                code: code,
                skippedLines: skippedLines
            };
        }
        
        return {
            inject: parseAndInject,
            prepare: prepare
        };
    }
    
    // colorize some of the tokens
    function colorize(code) {
        var ret = {};
        
        function color(type, pos, endpos) {
            if (!(type in ret)) ret[type] = [];
            ret[type].push({s: pos, e: endpos});
        }
        
        function colorNode(type, node, len) {
            var r = node.range;
            if (len != null) {
                color(type, r[0], r[0] + len);
            } else {
                color(type, r[0], r[1] + endposDelta);
            }
        }
        
        var ws = {
            BinaryExpression: function (node) {
                var idx = code.indexOf(node.operator, node.left.range[1] + endposDelta);
                if (idx !== -1 && idx < node.right.range[0]) {
                    if (node.operator.substring(0, 1) === "i") { // in, instanceof
                        colorNode("keyword", {range: [idx, 0]}, node.operator.length);
                    }
                }
            },
            BreakStatement: function (node) {
                colorNode("keyword", node, 5);
            },
            CatchClause: function (node) {
                colorNode("keyword", node, 5);
            },
            ContinueStatement: function (node) {
                colorNode("keyword", node, 8);
            },
            DoWhileStatement: function (node) {
                colorNode("keyword", node, 2);
                
                var idx = code.indexOf("while", node.body.range[1] + endposDelta);
                if (idx !== -1 && idx < node.test.range[0]) {
                    colorNode("keyword", {range: [idx, 0]}, 5);
                }
            },
            DebuggerStatement: function (node) {
                colorNode("keyword", node, 8);
            },
            ForStatement: function (node) {
                colorNode("keyword", node, 3);
            },
            ForInStatement: function (node) {
                colorNode("keyword", node, 3);
                if (!node.each) { // mozilla specific
                    var idx = code.indexOf("in", node.left.range[1] + endposDelta);
                    if (idx !== -1 && idx < node.right.range[0]) {
                        colorNode("keyword", {range: [idx, 0]}, 2);
                    }
                }
            },
            FunctionDeclaration: function (node) {
                markDeclarations(node.body.body);
                colorNode("keyword", node, 8);
            },
            FunctionExpression: function (node) {
                markDeclarations(node.body.body);
                if (code.substr(node.range[0], 1) === "f") {
                    colorNode("keyword", node, 8);
                }
            },
            IfStatement: function (node) {
                colorNode("keyword", node, 2);
                if (node.alternate != null) {
                    var r = node.alternate.range;
                    var ncr = node.consequent.range;
                    
                    var idx = code.lastIndexOf("else", r[0]); // else keyword not exposed by the parser
                    if (idx !== -1 && idx > ncr[1] + endposDelta) {
                        colorNode("keyword", {range: [idx, 0]}, 4);
                    }
                }
            },
            Literal: function (node) {
                if (node.value == null) {
                    colorNode("keyword", node);
                } else if (typeof node.value === "string") {
                    if (node.cj_isDirective) {
                        colorNode("directive", node);
                        return;
                    }
                    // there's a bug in esprima <= 0.9.9-dev
                    // null is not stored as null, but as "null" (string), fixed now
                    if (node.range[1] - node.range[0] === 4 - endposDelta) {
                        if (node.value === "null") {
                            colorNode("keyword", node);
                            return;
                        }
                    }
                    
                    colorNode("string", node);
                } else if (typeof node.value === "number") {
                    colorNode("num", node);
                } else {
                    switch (Object.prototype.toString.call(node.value)) {
                        /*jshint white: false*/
                        case "[object RegExp]":
                            return colorNode("regexp", node);
                        case "[object Boolean]":
                            return colorNode("boolean", node);
                        default:
                            console.log(Object.prototype.toString.call(node.value));
                    }
                }
            },
            LabeledStatement: function (node) {
                colorNode("label", node.label);
            },
            NewExpression: function (node) {
                colorNode("keyword", node, 3);
            },
            Program: function (node) {
                markDeclarations(node.body);
            },
            Property: function (node) {
                if (node.kind === "get" || node.kind === "let") {
                    colorNode("keyword", node, 3);
                }
                colorNode("property", node.key);
            },
            ReturnStatement: function (node) {
                colorNode("keyword", node, 6);
            },
            SwitchStatement: function (node) {
                colorNode("keyword", node, 6);
            },
            SwitchCase: function (node, switchKeyword) {
                colorNode("keyword", node, node.test == null ? 6 : 4);
            },
            ThisExpression: function (node, switchKeyword) {
                colorNode("keyword", node, 4);
            },
            ThrowStatement: function (node) {
                colorNode("keyword", node, 5);
            },
            TryStatement: function (node) {
                colorNode("keyword", node, 3);
            },
            UnaryExpression: function (node) {
                if (node.operator.length > 1) { // delete, void, typeof
                    colorNode("keyword", node, node.operator.length);
                }
            },
            VariableDeclaration: function (node) {
                colorNode("keyword", node, node.kind.length);
            },
            WhileStatement: function (node) {
                colorNode("keyword", node, 5);
            },
            WithStatement: function (node) {
                colorNode("keyword", node, 4);
            }
        };
         
        var ast;
        try {
            ast = esprima.parse(code, {range: true, comment: true});
        } catch (ex) {
            throw ex;
        }
        
        walkAll(ast, ws);
        var cmt = ast.comments;
        if (cmt != null) {
            for (var i = 0, il = cmt.length; i < il; i++) {
                var range = cmt[i].range;
                color("comment", range[0], range[1]);
            }
        }
        
        return ret;
    }
    
    if (typeof module !== "undefined") {
        module.exports = {
            createParser: init,
            colorize: colorize
        };
    }
}());