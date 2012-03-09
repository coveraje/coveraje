#  coveraje
## a simple javascript code coverage tool...

### Versions 
* __0.2.3__  
  Core: fix: exports points now to module.exports (node)  

* __0.2.2__  
  Core: use escodegen to generate the source from ast  

* __0.2.1__  
  Core: fix: remove uglify-js  

* __0.2.0__  
  Core: Use esprima as underlaying parser  
  Core: Add positions to inspect  
  Core: Mark parts of logical expressions as covered, if value is `true`  
  WebServer: Improve color coding  

* __0.1.3__  
  WebServer: Improve color coding  
  Core: Add function to output details   
  Helper: Add mocha helper  

* __0.1.2__  
  Core: Beautify code  
  WebServer: Refresh code after pressing F5  
  Core: __filename option  
  WebServer: Improve output  
  Core: Add uglify-js as dependency (remove submodule)  
  Core: Use uglify-js tokenizer to inspect elements  
  Core: Allow multiple files to inspect  
  WebServer: Show multiple files, if present  
  Core: Ability to use `require` (node). resolveRequires - option  

* __0.1.1__  
  Helper: Option support for helpers  
  Helper: Add `setTimeout` to context of expresso helper  
  Helper: Relative path in helpers  
  Helper: nodeunit-helper  
  Examples: jshint  
  Examples: uglifyjs  
  WebServer: Error messages (console)  
  WebServer: Line numbers  
  Core: Skip directives  
  Tests: lint all js-files with jshint  
  
* __0.1.0__  
  initial release (_alpha_)  
