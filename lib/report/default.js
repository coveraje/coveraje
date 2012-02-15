/*
    coveraje - a simple javascript code coverage tool.
    
    default report format
    ------------
    generates a condensed list of non-covered lines (per file)
    including source code and (first) occurence
    
    example output is
    {
        "file 1": [
            {
                source: "source of line 1",
                line: 2,            // the line number (starting at 1)
                pos: 4,             // the position of the first uncovered part of the line (starting at 1)
                parts: 1            // part count (how many parts are uncovered in this line)
            },
            // ...
        ]
    }
    
    Copyright (c) 2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

(function () {
    "use strict";
    
    var reportHelper = require("../report").helper;
    
    var ret = {};
    var linePosData = {};
        
    function file_data(data, filename, file, options, isCovered) {
        var source = file.code,
            skippedLines = file.skippedLines;
        
        var lpd = linePosData[filename];
        if (lpd == null) {
            lpd = linePosData[filename] = {};
        }
        
        var uncoveredData = data.filter(function (val) {
            return !isCovered(val);
            
        }).map(function (val) {
            var li = reportHelper.lineInfoFromPosition(val.s, source);
            
            var lip = lpd[li.line];
            
            var ret = {
                line: 1 + skippedLines + li.line,
                pos: 1 + li.pos,
                source: li.source,
                parts: 1
            };
            
            if (lip == null) {
                lpd[li.line] = ret;
                return ret;
            } else if (lip.pos > ret.pos) {
                lip.pos = ret.pos;
            }
            lip.parts = lip.parts + 1;
            return null;
            
        }).filter(function (val) {
            return val != null;
            
        }).sort(function (a, b) {
            if (a.line > b.line) {
                return 1;
            } else if (a.line < b.line) {
                return -1;
            }
            return 0;
            
        });
        
        if (ret[filename] == null) {
            ret[filename] = uncoveredData;
        } else {
            ret[filename] = ret[filename]
                .concat(uncoveredData)
                .sort(function (a, b) {
                    if (a.line > b.line) {
                        return 1;
                    } else if (a.line < b.line) {
                        return -1;
                    }
                    return 0;
                    
                });
        }
    }
    
    function getResult(options) {
        linePosData.length = 0;
        return ret;
    }
    
    if (typeof exports !== "undefined" && exports) {
        exports.format = {
            file: {
                data: {
                    visits: file_data,  
                    branches: file_data // "if"/"switch" statement is marked as uncovered
                }
            }
        };
        exports.result = getResult;
    }
}());