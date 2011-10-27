/*
    coveraje - a simple javascript code coverage tool.
    
    runtime
    ---------------
    methods invoked from the generated file
    
    Copyright (c) 2011 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

/*jshint
    node: true,
    white: true,
    eqnull: true,
    multistr: true,
    plusplus: false,
    regexp: true,
    strict: true,
    
    bitwise: true,
    eqeqeqe: true,
    forin: true,
    immed: true,
    latedef: true,
    newcap: true,
    noarg: true,
    noempty: true,
    nonew: true,
    undef: true,
    trailing: true
*/

function CoverajeRuntime() {
    "use strict";
    
    var visited, maxVisited;
    var branches;
    
    var hop = Object.prototype.hasOwnProperty;
    function isOwn(object, name) {
        return hop.call(object, name);
    }
    
    function visit_log(pos, endpos) {
        var idx = pos + "." + endpos;
        if (idx in visited) {
            maxVisited = Math.max(maxVisited, ++visited[idx].counter);
        }
    }
    
    function visit_register(pos, endpos) {
        var idx = pos + "." + endpos;
        if (!(idx in visited)) {
            visited[idx] = {pos: pos, endpos: endpos, counter: 0};
        }
    }
    
    function visitedArray(counted) {
        var ret = [];
        var idx;
        
        for (idx in visited) {
            if (isOwn(visited, idx)) {
                var v = visited[idx];
                ret.push({s: v.pos, e: v.endpos, c: v.counter, i: counted.indexOf(v.counter)});
            }
        }
        
        ret.sort(function (a, b) {
            if (a.s === b.s) {
                if (a.e === b.e) {
                    return 0;
                }
                return a.e < b.e ? 1 : -1;
            }
            return a.s < b.s ? -1 : 1;
        });
        return ret;
    }
    
    function branchesArray() {
        var ret = [];
        var idx, iidx;
        var br, bs, hasUntested;
        
        for (idx in branches) {
            if (isOwn(branches, idx)) {
                br = branches[idx];
                bs = [];
                hasUntested = false;
                for (iidx in br) {
                    if (iidx !== "pos" && iidx !== "endpos" && isOwn(br, iidx)) {
                        var b = br[iidx];
                        if (!hasUntested && b.counter === 0) hasUntested = true;
                        bs.push({s: b.pos, e: b.endpos, c: b.counter});
                    }
                }
                
                ret.push({s: br.pos, e: br.endpos, u: hasUntested, b: bs});
            }
        }
        
        return ret;
    }
    
    return {
        init: function () {
            maxVisited = 0;
            visited = {};
            branches = {};
        },
        
        reset: function () {
            var idx, iidx;
            
            maxVisited = 0;
            
            for (idx in visited) {
                if (isOwn(visited, idx)) {
                    visited[idx].counter = 0;
                }
            }
            
            for (idx in branches) {
                if (isOwn(branches, idx)) {
                    for (iidx in branches[idx]) {
                        if (isOwn(branches[idx], iidx)) {
                            branches[idx][iidx].counter = 0;
                        }
                    }
                }
            }
        },
        
        visit: {
            register: visit_register,
            call: visit_log,
            
            callWithRet: function (expr, pos, endpos) {
                visit_log(pos, endpos);
                return expr;
            },
            
            funcargs: function (args, positions) {
                var m = Math.min(args.length, positions.length);
                for (var i = 0; i < m; i++) {
                    visit_log(positions[i].pos, positions[i].endpos);
                }
            },
            
            isTested: function (el) {
                return el.c > 0;
            }
        },
        
        branch: {
            register: function (kpos, kend, pos, endpos, isElse) {
                if (pos !== 0 && endpos !== 0) {
                    visit_register(pos, endpos);
                }
                
                var idx = kpos + "." + kend;
                if (!(idx in branches)) {
                    branches[idx] = { pos: kpos, endpos: kend };
                }
                
                var iidx = pos + "." + endpos;
                if (!(iidx in branches[idx])) {
                    branches[idx][iidx] = {pos: pos, endpos: endpos, isElse: isElse, counter: 0};
                }
            },
            
            call: function (kpos, kend, pos, endpos) {
                if (pos !== 0 && endpos !== 0) {
                    visit_log(pos, endpos);
                }
                var idx = kpos + "." + kend;
                if (idx in branches) {
                    var iidx = pos + "." + endpos;
                    if (iidx in branches[idx]) {
                        branches[idx][iidx].counter++;
                    }
                }
            },
            
            isTested: function (el) {
                return !el.u;
            }
        },
        
        reportData: function () {
            var counted = [];
            var idx, v;
            
            for (idx in visited) {
                if (isOwn(visited, idx)) {
                    v = visited[idx];
                    if (counted.indexOf(v.counter) === -1) {
                        counted.push(v.counter);
                    }
                }
            }
            
            counted = counted.sort(function (a, b) {
                if (a === b) return 0;
                if (a < b) return -1;
                return 1;
            });
            
            if (counted[0] !== 0) counted.splice(0, 0, 0);
            
            return {
                counted: counted,
                visited: visitedArray(counted),
                branches: branchesArray()
            };
        }
    };
}

if (typeof exports == "object" && exports) {
    exports.CoverajeRuntime = CoverajeRuntime;
}