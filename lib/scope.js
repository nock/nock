var path            = require('path')
  , fs              = require('fs')
  , globalIntercept = require('./intercept')
  , assert          = require('assert')

var noop = function() {};

function startScope(basePath) {
  var interceptors = {}
    , scope
    , transformPathFunction
    , transformRequestBodyFunction
    , logger = noop;
  
  function add(key, interceptor) {
    if (! interceptors.hasOwnProperty(key)) {
      interceptors[key] = [];
    }
    interceptors[key].push(interceptor);
    globalIntercept(basePath, interceptor);
  }
  
  function remove(key, interceptor) {
    var arr = interceptors[key];
    if (arr) {
      arr.splice(arr.indexOf(interceptor), 1);
      if (arr.length === 0) { delete interceptors[key]; }
    }
  }
  
  function intercept(uri, method, requestBody) {
    var key = method.toUpperCase() + ' ' + basePath + uri;
    if (typeof(requestBody) !== 'string') {
      try {
        requestBody = JSON.stringify(requestBody);
      } catch(err) {
        throw new Error('Error encoding request body into JSON');
      }
    }
    
    if (requestBody) { key += (' ' + requestBody); } 
    
    function reply(statusCode, body, headers) {
      this.statusCode = statusCode;

      if (typeof(body) !== 'string' && !Buffer.isBuffer(body)) {
        try {
          body = JSON.stringify(body);
        } catch(err) {
          throw new Error('Error encoding response body into JSON');
        }
      }
      
      this.body = body;
      this.headers = headers;
      add(key, this);
      return scope;
    }
    
    function replyWithFile(statusCode, filePath, headers) {
      return reply.call(this, statusCode, fs.readFileSync(filePath), headers);
    }
    
    function match(options, body) {
      var method = options.method || 'GET'
        , path = options.path
        , matches;

      if (transformPathFunction) { path = transformPathFunction(path); }
      if (typeof(body) !== 'string') {
        body = body.toString();
      }
      if (transformRequestBodyFunction) { body = transformRequestBodyFunction(body); }
      var matchKey = method + ' http://' + options.host + path;
      if (body) { matchKey += (' ' + body); }
      matches = matchKey === this._key;
      logger('matching ' + matchKey + ' to ' + this._key + ': ' + matches);
      return matches;
    }
    
    function filteringPath() {
      if (typeof arguments[0] === 'function') {
        this.transformFunction = arguments[0];
      }
      return this;
    }
    
    function discard() {
      remove(this._key, this);
    }

    var interceptor = {
        _key: key
      , reply: reply
      , replyWithFile: replyWithFile
      , discard: discard
      , match: match
      , filteringPath: filteringPath
    };
    
    return interceptor;
  }

  function get(uri, requestBody) {
    return intercept(uri, 'GET', requestBody);
  }
  
  function post(uri, requestBody) {
    return intercept(uri, 'POST', requestBody);
  }

  function put(uri, requestBody) {
    return intercept(uri, 'PUT', requestBody);
  }

  function _delete(uri, requestBody) {
    return intercept(uri, 'DELETE', requestBody);
  }
  
  function pendingMocks() {
    return Object.keys(interceptors);
  }
  
  function isDone() {
    return (Object.keys(interceptors).length === 0, "Mocks not yet satisfied:\n" + pendingMocks().join("\n"));
  }
  
  function done() {
    assert.ok(isDone);
  }
  
  function filteringPath() {
    var filteringArguments = arguments;
    
    if (arguments[0] instanceof RegExp) {
      transformPathFunction = function(path) {
        if (path) {
          path = path.replace(filteringArguments[0], filteringArguments[1]);
        }
        return path;
      }
    } else {
      if (typeof (arguments[0]) === 'function') {
        transformPathFunction = arguments[0];
      } else {
        throw new Error('Invalid arguments: filtering path should be a function or a regular expression');
      }
    }
    return this;
  }
  
  function filteringRequestBody() {
    var filteringArguments = arguments;
    
    if (arguments[0] instanceof RegExp) {
      transformRequestBodyFunction = function(path) {
        if (path) {
          path = path.replace(filteringArguments[0], filteringArguments[1]);
        }
        return path;
      }
    } else {
      if (typeof (arguments[0]) === 'function') {
        transformRequestBodyFunction = arguments[0];
      } else {
        throw new Error('Invalid arguments: filtering request body should be a function or a regular expression');
      }
    }
    return this;
  }
  
  function log(newLogger) {
    logger = newLogger;
    return this;
  }
  
  scope = {
      get: get
    , post: post
    , delete: _delete
    , put: put
    , done: done
    , isDone: isDone
    , filteringPath: filteringPath
    , filteringRequestBody: filteringRequestBody
    , log: log
  };

  return scope;
}

module.exports = startScope;
