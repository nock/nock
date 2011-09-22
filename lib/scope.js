var path            = require('path')
  , globalIntercept = require('./intercept')
  , assert          = require('assert')

function startScope(basePath) {
  var interceptors = {}
    , scope;
  
  function add(key, interceptor) {
    if (! interceptors.hasOwnProperty(key)) {
      interceptors[key] = [];
    }
    interceptors[key].push(interceptor);
    globalIntercept(basePath, interceptor);
  }
  
  function remove(key, interceptor) {
    var arr = interceptors[key];
    arr.splice(arr.indexOf(interceptor), 1);
    if (arr.length === 0) { delete interceptors[key]; }
  }
  
  function intercept(uri, method, requestBody) {
    var key = method.toUpperCase() + ' ' + basePath + uri;
    if (requestBody) { key += (' ' + requestBody); }
    
    function reply(statusCode, body, headers) {
      this.statusCode = statusCode;
      this.body = body;
      this.headers = headers;
      add(key, this);
      return scope;
    }
    
    function match(options, body) {
      var method = options.method || 'GET';
      var matchKey = method + ' http://' + options.host + options.path;
      if (body) { matchKey += (' ' + body); }
      return matchKey === this._key;
    }
    
    function discard() {
      remove(this._key, this);
    }

    var interceptor = {
        _key: key
      , reply: reply
      , discard: discard
      , match: match
    };
    
    return interceptor;
  }

  function get(uri) {
    return intercept(uri, 'GET');
  }
  
  function post(uri, requestBody) {
    return intercept(uri, 'POST', requestBody);
  }
  
  function pendingMocks() {
    return Object.keys(interceptors);
  }
  
  function done() {
    assert.ok(Object.keys(interceptors).length === 0, "Mocks not yet satisfied:\n" + pendingMocks().join("\n"));
  }
  
  scope = {
      get: get
    , post: post
    , done: done
  };

  return scope;
}

module.exports = startScope;