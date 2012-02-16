/*
    coveraje - a simple javascript code coverage tool.
    
    report
    ------------
    helper for report results in different formats
    
    Copyright (c) 2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

(function () {
    "use strict";
    
    function lineInfoFromPosition(position, source) {
        if (position > source.length) position = source.length;
        
        var end = source.indexOf("\n", position);
        if (end === -1) end = source.length;
        
        var pn = position === 0 ? 0 : source.lastIndexOf("\n", position - 1) + 1;
        var sourceLine = source.substring(pn, end);
        
        var l = 0;
        var pos = position - 1;
        while (pos > -1) {
            l++;
            pos = source.lastIndexOf("\n", pos)  - 1;
        }
        
        return {
            line: l,
            pos: position - pn,
            source: sourceLine
        };
    }
    
    
    function report(instance) {
        var defaultOptions = {
            dataSort: ["visits", "branches"]
        };
        
        var utils = require("./utils").utils,
            shell = require("./shell").createShell(instance.options),
            subfolder = "./report/";
        
        function callPerFile(data, file, filename, format, options) {
            if (typeof format.header === "function") {
                format.header(data, filename, file, options);
            }
            
            if (format.data != null) {
                var fn, i, il;
                var o = options.dataSort;
                var index = file.index;
                
                for (i = 0, il = o.length; i < il; i++) {
                    var p = o[i];
                    fn = format.data[p];
                    
                    if (typeof fn === "function" && instance.runtime[p] != null && typeof instance.runtime[p].isCovered === "function") {
                        var dp = data[p];
                        if (dp != null && dp[index] != null) {
                            var d = dp[index];
                            
                            fn(dp[index], filename, file, options, instance.runtime[p].isCovered);
                        }
                    }
                }
            } else {
                shell.write("<color red bright>Error:</color> format.file.data not found");
                return false;
            }
            
            if (typeof format.footer === "function") {
                format.footer(data, filename, file, options);
            }
        }
        
        function call(data, format, options) {
            if (typeof format.header === "function") {
                format.header(data, options);
            }
            
            if (format.file != null) {
                var source;
                
                var files = instance.getCodes();
                var ks = Object.keys(files);
                for (var i = 0, il = ks.length; i < il; i++) {
                    var fid = ks[i];
                    var file = files[fid];
                    
                    if (callPerFile(data, file, fid, format.file, options) === false) return false;
                }
            } else {
                shell.write("<color red bright>Error:</color> format.file not found");
                return false;
            }
            
            
            if (typeof format.footer === "function") {
                format.footer(data, options);
            }
        }
        
        function createReport(format, userOptions) {
            var outputFormat;
            
            if (typeof format === "string") {
                if (/^\w+$/.test(format)) {
                    try {
                        outputFormat = require(subfolder + format);
                    } catch (ex) {
                        shell.write("<color red bright>Error:</color> output format '%s' not found", format);
                    }
                }
            } else {
                outputFormat = format;
            }
            
            if (outputFormat == null) {
                outputFormat = require(subfolder + "default");
            }
            
            if (outputFormat != null) {
                if (outputFormat.format != null) {
                    var data = instance.runtime.reportData();
                    delete data.counted; // not needed here
                    var options = utils.doOptions(userOptions, outputFormat.options, defaultOptions);
                    
                    if (call(data, outputFormat.format, options) === false) {
                        return null;
                    }
                    if (typeof outputFormat.result === "function") {
                        return outputFormat.result(options);
                    } else {
                        shell.write("<color red bright>Error:</color> format.result() not found");
                    }
                } else {
                    shell.write("<color red bright>Error:</color> format not found");
                }
            }
            
            return null;
        }
        
        return {
            create: createReport
        };
    }
    
    if (typeof exports !== "undefined" && exports) {
        exports.report = report;
        exports.helper = {
            lineInfoFromPosition: lineInfoFromPosition
        };
    }
}());