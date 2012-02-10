var path            = require('path')
  , fs              = require('fs')
  , globalIntercept = require('./intercept')
  , assert          = require('assert')

var noop = function() {};

function startScope(basePath, options) {
  var interceptors = {},
      scope,
      transformPathFunction,
      transformRequestBodyFunction,
      matchHeaders = [],
      logger = noop,
      scopeOptions = options || {};
  
  function add(key, interceptor) {
    if (! interceptors.hasOwnProperty(key)) {
      interceptors[key] = [];
    }
    interceptors[key].push(interceptor);
    interceptor.options = scopeOptions;
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
    var interceptorMatchHeaders = [];
    var key = method.toUpperCase() + ' ' + basePath + uri;
    if (typeof(requestBody) != 'undefined' && typeof(requestBody) !== 'string') {
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
      
      
      if (headers !== undefined) {
        this.headers = {};

        // makes sure all keys in headers are in lower case
        var key2;
        for (key2 in headers) {
          if (headers.hasOwnProperty(key2)) {
            this.headers[key2.toLowerCase()] = headers[key2];
          }
        }
      }

      this.body = body;
      add(key, this);
      return scope;
    }
    
    function replyWithFile(statusCode, filePath, headers) {
      return reply.call(this, statusCode, fs.readFileSync(filePath), headers);
    }
    
    function match(options, body) {
      var method = options.method || 'GET'
        , path = options.path
        , matches
        , proto = options.proto;
        
      if (transformPathFunction) { path = transformPathFunction(path); }
      if (typeof(body) !== 'string') {
        body = body.toString();
      }
      if (transformRequestBodyFunction) { body = transformRequestBodyFunction(body); }


      var checkHeaders = function(header) {
        return options.getHeader(header.name) === header.value;
      };
      if (!matchHeaders.every(checkHeaders) ||
          !interceptorMatchHeaders.every(checkHeaders)) {
        return false;
      }

      var matchKey = method + ' ' + proto + '://' + options.host + path;
      if (body) { matchKey += (' ' + body); }
      matches = matchKey === this._key;
      logger('matching ' + matchKey + ' to ' + this._key + ': ' + matches);
      return matches;
    }

    function matchIndependentOfBody(options) {
      var method = options.method || 'GET'
        , path = options.path
        , matches
        , proto = options.proto;
        
      if (transformPathFunction) { path = transformPathFunction(path); }

      var checkHeaders = function(header) {
        return options.getHeader && options.getHeader(header.name) === header.value;
      };
      if (!matchHeaders.every(checkHeaders) ||
          !interceptorMatchHeaders.every(checkHeaders)) {
        return false;
      }

      var matchKey = method + ' ' + proto + '://' + options.host + path;
      return this._key === matchKey
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

    function matchHeader(name, value) {
      interceptorMatchHeaders.push({ name: name, value: value });
      return this;
    }

    var interceptor = {
        _key: key
      , reply: reply
      , replyWithFile: replyWithFile
      , discard: discard
      , match: match
      , matchIndependentOfBody: matchIndependentOfBody
      , filteringPath: filteringPath
      , matchHeader: matchHeader
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
    return (Object.keys(interceptors).length === 0);
  }
  
  function done() {
    assert.ok(isDone(), "Mocks not yet satisfied:\n" + pendingMocks().join("\n"));
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

  function matchHeader(name, value) {
    matchHeaders.push({ name: name, value: value });
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
    , intercept: intercept
    , done: done
    , isDone: isDone
    , filteringPath: filteringPath
    , filteringRequestBody: filteringRequestBody
    , matchHeader: matchHeader
    , log: log
  };

  return scope;
}

module.exports = startScope;
