/*
    coveraje - a simple javascript code coverage tool.
    
    client script
    
    Copyright (c) 2011-2012 Wolfgang Kluge (klugesoftware.de, gehirnwindung.de)
*/

/*jshint
    jquery: true,
    browser: true,
    devel: true
*/

var coverajeResults = (function () {
    "use strict";
    
    var settings;
    var lastRunData;
    var currentFileID;
    
    //
    // helper for "hasOwnProperty"
    var hop = Object.prototype.hasOwnProperty;
    function isOwn(object, name) {
        return hop.call(object, name);
    }
    
    var colors = (function () {
        var maxColors = 100;
        var colorMatrix = [
            [0.95, 0.95, 1],
            [1,    0.75, 0],
            [0.5,  0,    1],
            [0,    0.25, 1],
            [0.25, 0.75, 0.75],
            [0.5,  0.75, 0.25]
        ];
        
        function cv(r, g, b) {
            return {r: r * 0xFF, g: g * 0xFF, b: b * 0xFF};
        }
        
        function calc(max, value) {
            if (value < 1) return cv(1, 0, 0);
            var p = (value - 1) / (max || 1);
            
            var n = colorMatrix.length - 1;
            for (var i = 0; i < n; i++) {
                if (p <= (i + 1) / n) {
                    p -= i / n;
                    p *= n;
                    
                    var cm = colorMatrix[i + 1];
                    var cmp = colorMatrix[i];
                    return cv(
                        cmp[0] + p * (cm[0] - cmp[0]),
                        cmp[1] + p * (cm[1] - cmp[1]),
                        cmp[2] + p * (cm[2] - cmp[2])
                    );
                }
            }
        }
        
        function brightness(c) {
            return Math.sqrt(
                c.r * c.r * 0.241 +
                c.g * c.g * 0.691 +
                c.b * c.b * 0.068
            );
        }
        
        function hex6(val, txtColor) {
            /*jshint bitwise: false*/
            if (txtColor) {
                if (brightness(val) < 128) {
                    val = cv(1, 1, 1);
                } else {
                    val = cv(0, 0, 0);
                }
            }
            var v = (val.r << 16 | val.g << 8 | val.b);
            return "#" + ((v & 0xFFFFFF) + 0x1000000).toString(16).substr(1);
        }
        
        return {
            calc: calc,
            hex: hex6,
            maxColors: maxColors
        };
    }());
    
    //
    // colorize-function
    // allows overlapping definitions
    function colorize(data, text, scriptColors) {
        var lens = [text.length];
        var st = [null];
        
        function setColors(start, end, attrs) {
            var startIndex = -1, endIndex = -1;
            var startLen, endLen;
            var len = 0;
            
            function meltAttrs(minor) {
                var m, ret = {};
                
                for (m in attrs) {
                    if (isOwn(attrs, m)) {
                        ret[m] = attrs[m];
                    }
                }
                
                for (m in minor) {
                    if (isOwn(minor, m)) {
                        if (ret[m] == null && minor[m] != null) ret[m] = minor[m];
                    }
                }
                
                return ret;
            }
            
            function split(idx, pos) {
                if (pos > 0) {
                    lens[idx] -= pos;
                    
                    if (lens[idx] === 0) {
                        lens[idx] = pos;
                        return false;
                    } else {
                        lens.splice(idx, 0, pos);
                        st.splice(idx, 0, st[idx]);
                        return true;
                    }
                }
                return false;
            }
            
            for (var j = 0; j < lens.length; j++) {
                var l = lens[j];
                if (startIndex === -1 && len + l >= start) {
                    startLen = len;
                    startIndex = j;
                }
                if (endIndex === -1 && len + l >= end) {
                    endLen = len;
                    endIndex = j;
                    break;
                }
                len += l;
            }
            
            if (startIndex !== -1 && endIndex !== -1) {
                var tl;
                if (startIndex === endIndex) {
                    split(startIndex, end - startLen);
                    if (split(startIndex, start - startLen)) startIndex++;
                    
                    st[startIndex] = meltAttrs(st[startIndex]);
                } else {
                    if (split(startIndex, start - startLen)) endIndex++;
                    split(endIndex, end - endLen);
                    
                    for (var i = startIndex + 1; i <= endIndex; i++) {
                        st[i] = meltAttrs(st[i]);
                    }
                }
            }
        }
        
        function searchWithIdx(el) {
            return el.c > 0;
        }
        
        var col, ci, dl, i;
       
        // simple color coding
        if (scriptColors) {
            for (var k in scriptColors) {
                if (isOwn(scriptColors, k) && scriptColors[k]) {
                    col = scriptColors[k];
                    dl = col.length;
                    for (i = 0; i < dl; i++) {
                        ci = col[i];
                        
                        setColors(ci.s, ci.e, {
                            "class": "cc_" + k
                        });
                    }
                }
            }
        }
        
        if (data && data.counted) {
            var max = data.counted.length;
            if (data.visits) {
                dl = data.visits.length;
                
                for (i = 0; i < dl; i++) {
                    ci = data.visits[i];
                    col = colors.calc(max, ci.i);
                    
                    setColors(ci.s, ci.e, {
                        "style": "color: " + colors.hex(col, true) + "; background-color:" + colors.hex(col),
                        "title": ci.c
                    });
                }
            }
            
            if (data.branches) {
                dl = data.branches.length;
                for (i = 0; i < dl; i++) {
                    ci = data.branches[i];
                    
                    var used = !ci.u || ci.b.some(searchWithIdx);
                    if (used) {
                        setColors(ci.s, ci.e, {
                            "class": ci.u ? "br_ic" : "br_c",
                            "title": ci.u ? "incomplete" : "complete"
                        });
                    } else {
                        col = colors.calc(max, 0);
                        setColors(ci.s, ci.e, {
                            "style": "color: " + colors.hex(col, true) + "; background-color:" + colors.hex(col),
                            "title": "0"
                        });
                    }
                    
                }
            }
        }
        
        // output html
        var out = [];
        var apo = /'/g;
        var lt = /</g;
        
        ci = 0;
        dl = lens.length;
        
        for (i = 0; i < dl; i++) {
            col = st[i];
            if (col != null) {
                out.push("<span");
                
                for (var m in col) {
                    if (isOwn(col, m) && col[m] != null) {
                        var cm = String(col[m]);
                        out.push(" " + m + "='" + cm.replace(apo, "&apos;") + "'");
                    }
                }
                out.push(">");
            }
            
            out.push(
                text
                    .substr(ci, lens[i])
                    .replace(lt, "&lt;")
            );
            
            if (col != null) {
                out.push("</span>");
            }
            ci += lens[i];
        }
        
        lens.length = 0;
        st.length = 0;
        return out.join("");
    }
    
    function getRepData() {
        return lastRunData ? {
            branches: lastRunData.branches[currentFileID],
            visits: lastRunData.visits[currentFileID],
            counted: lastRunData.counted
        } : null;
    }
    
    function showText(code) {
        var $d = $(document);
        var spt = $d.scrollTop();
        var spl = $d.scrollLeft();
        $("#code").html(code.replace(/\t/g, "<span class='tab'>\t</span>"));
        $d.scrollTop(spt).scrollLeft(spl);
    }
    
    function showLines(skippedLines, code) {
        setTimeout(function () {
            var start = skippedLines + 1;
            var n = /\n/g;
            $("#lines").html(
                $.makeArray($.map(code.split(n), function (el, idx) {
                    return idx + start;
                })).join("\n")
            );
        }, 1);
    }
    
    function showFile(f) {
        var repData = getRepData();
        
        showLines(f.skippedLines, f.code);
        showText(colorize(repData, f.code, f.colors));
    }
    
    function showFiles(codes) {
        
        if (codes.length === 1) {
            currentFileID = 0;
            showFile(settings.codes[0]);
            $("BODY").addClass("no-files");
        } else if (codes.length > 1) {
            var cf;
            $("#files>select option").each(function () {
                var $t = $(this);
                var vid = parseInt($(this).val(), 10);
                if (vid === currentFileID) {
                    cf = ($t.parent("optgroup").attr("label") || "") + $t.text();
                    return false;
                }
            });
            
            var $sel = $("<select/>").on("change", function () {
                var nfid = parseInt($(this).val(), 10);
                if (currentFileID !== nfid) {
                    currentFileID = nfid;
                    $(document).scrollTop(0).scrollLeft(0);
                }
                showFile(settings.codes[currentFileID]);
            });
            
            currentFileID = 0;
            
            var uc = codes.map(function (v) {
                var n = v.name;
                var pdx = n.lastIndexOf("/");
                if (pdx === -1) pdx = n.lastIndexOf("\\");
                
                return {
                    path: n.substr(0, pdx + 1) || "",
                    name: n.substr(pdx + 1),
                    index: v.index
                };
            });
            
            uc.sort(function (a, b) {
                var an = a.path.toLowerCase();
                var bn = b.path.toLowerCase();
                
                if (an > bn) {
                    return 1;
                } else if (an < bn) {
                    return -1;
                }
                
                an = a.name.toLowerCase();
                bn = b.name.toLowerCase();
                if (an > bn) {
                    return 1;
                } else if (an < bn) {
                    return -1;
                }
                return 0;
            });
            
            var lastPath = "";
            var $at = $sel;
            for (var i = 0, il = uc.length; i < il; i++) {
                var path = uc[i].path;
                var name = uc[i].name;
                var idx = uc[i].index;
                
                if (path + name === cf) {
                    currentFileID = idx;
                }
                
                if (lastPath !== path) {
                    lastPath = path;
                    $at = $("<optgroup/>")
                        .attr("label", path)
                        .appendTo($sel);
                }
                
                $("<option/>")
                    .val(idx)
                    .text(name)
                    .appendTo($at);
            }
            
            $sel
                .appendTo($("#files").empty())
                .val(currentFileID)
                .trigger("change");
            
            $("BODY").removeClass("no-files");
        }
    }
    
    function currentText() {
        if (settings.codes != null) {
            return settings.codes[currentFileID].code;
        }
        return "";
    }
    
    function show() {
        var repData = getRepData();
        var max = repData.counted.length;
        $("#colors").empty();
        
        // show the colors
        var $c = $("<div>");
        var um = Math.max(1, max / colors.maxColors);
        
        var doMax = Math.min(max, colors.maxColors);
        var doDiff = Math.max(1, (max - 1) / (colors.maxColors - 1));
        for (var i = 0; i < doMax; i += 1) {
            /*jshint white: false*/
            var ii = Math.round(i * doDiff);
            var col = colors.calc(max, ii);
            var d = i < 2 ? repData.counted[i] : repData.counted[ii];
            if (d == null) d = "";
            
            $c.append(
                $("<span/>")
                    .css({
                        color: colors.hex(col, true),
                        backgroundColor: colors.hex(col)
                    })
                    .text(i < 2 || i === doMax - 1 ? d : "")
                    .attr("title", d)
            );
        }
        $c.children().appendTo($("#colors"));
        $c = null;
    }
    
    function runTest(runnerid) {
        var $w = $(".wait").show();
        $.ajax({
            cache: false,
            url: "coveraje.json",
            data: {
                runnerid: runnerid
            },
            dataType: "json",
            contentType: "application/json",
            success: function (a) {
                lastRunData = a.report;
                settings.codes = a.files;
                showFiles(a.files);
                
                show();
            },
            error: function (r) {
                if (window.console) console.log("error", r);
            },
            complete: function () {
                $w.hide();
            }
        });
    }
    
    function showRunners(runners) {
        if (runners) {
            var $t = $("<div/>");
            
            for (var i = -1, il = runners.length; i < il; i++) {
                var n = runners[i] || ""; //
                
                $t.append(
                    $("<button />")
                        .text(i === -1 ? "(test all)" : n)
                        .data("runnerid", n)
                );
            }
            
            $t.children().appendTo($("#tests").empty());
            $t = null;
        }
    }
    
    function init() {
        $.ajax({
            cache: false,
            url: "coveraje.json",
            data: {
                init: true
            },
            dataType: "json",
            contentType: "application/json",
            success: function (a) {
                settings = a;
                
                if (a) {
                    var cde, skipped;
                    if (a.codes && a.codes.length > 0) {
                        showFiles(a.codes);
                        showFile(a.codes[0]);
                    }
                    showRunners(a.runner);
                }
            },
            error: function (r) {
                if (window.console) console.log("error", r);
            }
        });
    }
    
    // register events
    $("#tests button").live("click", function () {
        runTest($(this).data("runnerid"));
    });
    
    return {
        show: show,
        init: init,
        run: runTest
    };
}());

$(function () {
    "use strict";
    
    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/some
    if (!Array.prototype.some) {
        Array.prototype.some = function (fun) {
            /*jshint bitwise: false, newcap: false*/
            
            if (this === void 0 || this === null) {
                throw new TypeError();
            }

            var t = Object(this);
            var len = t.length >>> 0;
            if (typeof fun !== "function") {
                throw new TypeError();
            }

            var thisp = arguments[1];
            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(thisp, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }
    
    var $lines = $(".lines"), lastScrollX;
    $(window).on("scroll", function () {
        if (window.scrollX !== lastScrollX) {
            lastScrollX = window.scrollX;
            $lines.css("left", lastScrollX);
        }
    });
    
    // init
    coverajeResults.init();
});
