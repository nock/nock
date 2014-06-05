/**
 * @module nock/scope
 */
var fs              = require('fs')
  , globalIntercept = require('./intercept')
  , mixin           = require('./mixin')
  , matchBody       = require('./match_body')
  , common          = require('./common')
  , assert          = require('assert')
  , url             = require('url')
  , _               = require('lodash')
  , debug           = require('debug')('nock.scope');

function isStream(obj) {
  return (typeof obj !== 'undefined') && (typeof a !== 'string') && (! Buffer.isBuffer(obj)) && (typeof obj.setEncoding === 'function');
}

function startScope(basePath, options) {
  var interceptors = {},
      scope,
      transformPathFunction,
      transformRequestBodyFunction,
      matchHeaders = [],
      logger = debug,
      scopeOptions = options || {},
      urlParts = url.parse(basePath),
      port = urlParts.port || ((urlParts.protocol === 'http:') ? 80 : 443),
      persist = false;

  basePath = urlParts.protocol + '//' + urlParts.hostname + ':' + port;

  function add(key, interceptor, scope) {
    if (! interceptors.hasOwnProperty(key)) {
      interceptors[key] = [];
    }
    interceptors[key].push(interceptor);
    globalIntercept(basePath, interceptor, scope, scopeOptions);
  }

  function remove(key, interceptor) {
    if (persist) {
      return;
    }
    var arr = interceptors[key];
    if (arr) {
      arr.splice(arr.indexOf(interceptor), 1);
      if (arr.length === 0) { delete interceptors[key]; }
    }
  }

  function intercept(uri, method, requestBody, interceptorOptions) {
    var interceptorMatchHeaders = [];
    var key = method.toUpperCase() + ' ' + basePath + uri;

    function reply(statusCode, body, headers) {
      this.statusCode = statusCode;

      this.options = interceptorOptions || {};
      for(var opt in scopeOptions) {
        if(typeof this.options[opt] === 'undefined') {
          this.options[opt] = scopeOptions[opt];
        }
      }

      if (scope._defaultReplyHeaders) {
        headers = headers || {};
        headers = mixin(scope._defaultReplyHeaders, headers);
      }

      if (headers !== undefined) {
        this.headers = {};

        // makes sure all keys in headers are in lower case
        for (var key2 in headers) {
          if (headers.hasOwnProperty(key2)) {
            this.headers[key2.toLowerCase()] = headers[key2];
          }
        }
      }

      //  If the content is not encoded we may need to transform the response body.
      //  Otherwise we leave it as it is.
      if(!common.isContentEncoded(headers)) {
        if (body && typeof(body) !== 'string' && typeof(body) !== 'function' && !Buffer.isBuffer(body) && !isStream(body)) {
          try {
            body = JSON.stringify(body);
            if (!this.headers) {
              this.headers = {};
            }
            if (!this.headers['content-type']) {
              this.headers['content-type'] = 'application/json';
            }
          } catch(err) {
            throw new Error('Error encoding response body into JSON');
          }
        }
      }

      this.body = body;

      add(key, this, scope, scopeOptions);
      return scope;
    }

    function replyWithFile(statusCode, filePath, headers) {
      var readStream = fs.createReadStream(filePath);
      readStream.pause();
      this.filePath = filePath;
      return reply.call(this, statusCode, readStream, headers);
    }

    var matchStringOrRegexp = function(target, pattern) {
      if (pattern instanceof RegExp) {
        return target.match(pattern);
      } else {
        return target === pattern;
      }
    };

    function match(options, body, hostNameOnly) {
      if (hostNameOnly) {
        return options.hostname === urlParts.hostname;
      }

      var method = options.method || 'GET'
        , path = options.path
        , matches
        , proto = options.proto;

      if (transformPathFunction) {
        path = transformPathFunction(path);
      }
      if (typeof(body) !== 'string') {
        body = body.toString();
      }
      if (transformRequestBodyFunction) {
        body = transformRequestBodyFunction(body);
      }

      var checkHeaders = function(header) {
        return matchStringOrRegexp(options.getHeader(header.name), header.value);
      };




      if (!matchHeaders.every(checkHeaders) ||
          !interceptorMatchHeaders.every(checkHeaders)) {
        logger('headers don\'t match');
        return false;
      }

      // Also match request headers
      // https://github.com/pgte/nock/issues/163
      function reqheaderMatches(key) {
        return ! options.headers || options.headers[key] == this.reqheaders[key];
      }

      var reqHeadersMatch =
        ! this.reqheaders ||
        Object.keys(this.reqheaders).every(reqheaderMatches.bind(this));

      if (!reqHeadersMatch) {
        logger('request headers don\'t match');
        return false;
      }

      var matchKey = method.toUpperCase() + ' ';

      //  If we have a filtered scope then we use it instead reconstructing
      //  the scope from the request options (proto, host and port) as these
      //  two won't necessarily match and we have to remove the scope that was
      //  matched (vs. that was defined).
      if(this.__nock_filteredScope) {
        matchKey += this.__nock_filteredScope;
      } else {
        matchKey += proto + '://' + options.host;
        if (
             options.port && options.host.indexOf(':') < 0 &&
             (options.port !== 80 || options.proto !== 'http') &&
             (options.port !== 443 || options.proto !== 'https')
           ) {
          matchKey += ":" + options.port;
        }
      }
      matchKey += path;
      matches = matchKey === this._key;
      logger('matching ' + matchKey + ' to ' + this._key + ': ' + matches);
      if (matches) {
        matches = (matchBody.call(options, this._requestBody, body));
        if(!matches) {
          logger('bodies don\'t match');
        }
      }

      return matches;
    }

    function matchIndependentOfBody(options) {
      var method = options.method || 'GET'
        , path = options.path
        , proto = options.proto;

      if (transformPathFunction) {
        path = transformPathFunction(path);
      }

      var checkHeaders = function(header) {
        return options.getHeader && matchStringOrRegexp(options.getHeader(header.name), header.value);
      };

      if (!matchHeaders.every(checkHeaders) ||
          !interceptorMatchHeaders.every(checkHeaders)) {
        return false;
      }

      var matchKey = method + ' ' + proto + '://' + options.host + path;
      return this._key === matchKey;
    }

    function filteringPath() {
      if (typeof arguments[0] === 'function') {
        this.transformFunction = arguments[0];
      }
      return this;
    }

    function discard() {
      if (persist && this.filePath) {
        this.body = fs.createReadStream(this.filePath);
        this.body.pause();
      }

      if (! persist) {
        remove(this._key, this);
      }
    }

    function matchHeader(name, value) {
      interceptorMatchHeaders.push({ name: name, value: value });
      return this;
    }

    /**
     * Set number of times will repeat the interceptor
     * @name times
     * @param Integer Number of times to repeat (should be > 0)
     * @public
     * @example
     * // Will repeat mock 5 times for same king of request
     * nock('http://zombo.com).get('/').times(5).reply(200, 'Ok');
    */
    function times(newCounter) {
      if (newCounter < 1) {
        return this;
      }

      this.counter = newCounter;

      return this;
    }

    /**
     * An sugar sintaxe for times(1)
     * @name once
     * @see {@link times}
     * @public
     * @example
     * nock('http://zombo.com).get('/').once.reply(200, 'Ok');
    */
    function once() {
      return this.times(1);
    }

    /**
     * An sugar sintaxe for times(2)
     * @name twixe
     * @see {@link times}
     * @public
     * @example
     * nock('http://zombo.com).get('/').twice.reply(200, 'Ok');
    */
    function twice() {
      return this.times(2);
    }

    /**
     * An sugar sintaxe for times(3).
     * @name thrice
     * @see {@link times}
     * @public
     * @example
     * nock('http://zombo.com).get('/').thrice.reply(200, 'Ok');
    */
    function thrice() {
      return this.times(3);
    }

    /**
     * Delay the response by a certain number of ms.
     *
     * @param  {integer} ms - Number of milliseconds to wait
     * @return {scope} - the current scope for chaining
     */
    function delay(ms) {
      this.delayInMs = ms;
      return this;
    }

    /**
     * Delay the connection by a certain number of ms.
     *
     * @param  {integer} ms - Number of milliseconds to wait
     * @return {scope} - the current scope for chaining
     */
    function delayConnection(ms) {
      this.delayConnectionInMs = ms;
      return this;
    }

    var interceptor = {
        _key: key
      , counter: 1
      , _requestBody: requestBody
      , reqheaders: (options && options.reqheaders) || {}
      , reply: reply
      , replyWithFile: replyWithFile
      , discard: discard
      , match: match
      , matchIndependentOfBody: matchIndependentOfBody
      , filteringPath: filteringPath
      , matchHeader: matchHeader
      , times: times
      , once: once
      , twice: twice
      , thrice: thrice
      , delay: delay
      , delayConnection: delayConnection
    };

    return interceptor;
  }

  function get(uri, requestBody, options) {
    return intercept(uri, 'GET', requestBody, options);
  }

  function post(uri, requestBody, options) {
    return intercept(uri, 'POST', requestBody, options);
  }

  function put(uri, requestBody, options) {
    return intercept(uri, 'PUT', requestBody, options);
  }

  function head(uri, requestBody, options) {
    return intercept(uri, 'HEAD', requestBody, options);
  }

  function patch(uri, requestBody, options) {
    return intercept(uri, 'PATCH', requestBody, options);
  }

  function merge(uri, requestBody, options) {
    return intercept(uri, 'MERGE', requestBody, options);
  }

  function _delete(uri, requestBody, options) {
    return intercept(uri, 'DELETE', requestBody, options);
  }

  function pendingMocks() {
    return Object.keys(interceptors);
  }

  function isDone() {

    // if nock is turned off, it always says it's done
    if (! globalIntercept.isOn()) { return true; }

    var keys = Object.keys(interceptors);
    if (keys.length === 0) {
      return true;
    } else {
      var doneHostCount = 0;

      keys.forEach(function(key) {
        var doneInterceptorCount = 0;

        interceptors[key].forEach(function(interceptor) {
          var isDefined = (typeof interceptor.options.requireDone !== 'undefined');
          if (isDefined && interceptor.options.requireDone === false) {
            doneInterceptorCount += 1;
          }
        });

        if( doneInterceptorCount === interceptors[key].length ) {
          doneHostCount += 1;
        }
      });
      return (doneHostCount === keys.length);
    }
  }

  function done() {
    assert.ok(isDone(), "Mocks not yet satisfied:\n" + pendingMocks().join("\n"));
  }

  function buildFilter() {
    var filteringArguments = arguments;

    if (arguments[0] instanceof RegExp) {
      return function(path) {
        if (path) {
          path = path.replace(filteringArguments[0], filteringArguments[1]);
        }
        return path;
      };
    } else if (typeof (arguments[0]) === 'function') {
      return arguments[0];
    }
  }

  function filteringPath() {
    transformPathFunction = buildFilter.apply(undefined, arguments);
    if (!transformPathFunction) {
      throw new Error('Invalid arguments: filtering path should be a function or a regular expression');
    }
    return this;
  }

  function filteringRequestBody() {
    transformRequestBodyFunction = buildFilter.apply(undefined, arguments);
    if (!transformRequestBodyFunction) {
      throw new Error('Invalid arguments: filtering request body should be a function or a regular expression');
    }
    return this;
  }

  function matchHeader(name, value) {
    matchHeaders.push({ name: name, value: value });
    return this;
  }

  function defaultReplyHeaders(headers) {
    this._defaultReplyHeaders = headers;
    return this;
  }

  function log(newLogger) {
    logger = newLogger;
    return this;
  }

  function _persist() {
    persist = true;
    return this;
  }

  function shouldPersist() {
    return persist;
  }


  scope = {
      get: get
    , post: post
    , delete: _delete
    , put: put
    , merge: merge
    , patch: patch
    , head: head
    , intercept: intercept
    , done: done
    , isDone: isDone
    , filteringPath: filteringPath
    , filteringRequestBody: filteringRequestBody
    , matchHeader: matchHeader
    , defaultReplyHeaders: defaultReplyHeaders
    , log: log
    , persist: _persist
    , shouldPersist: shouldPersist
    , pendingMocks: pendingMocks
  };

  return scope;
}

function cleanAll() {
  globalIntercept.removeAll();
  return module.exports;
}

function loadDefs(path) {
  var contents = fs.readFileSync(path);
  return JSON.parse(contents);
}

function load(path) {
  return define(loadDefs(path));
}

function getStatusFromDefinition(nockDef) {
  //  Backward compatibility for when `status` was encoded as string in `reply`.
  if(!_.isUndefined(nockDef.reply)) {
    //  Try parsing `reply` property.
    var parsedReply = parseInt(nockDef.reply, 10);
    if(_.isNumber(parsedReply)) {
      return parsedReply;
    }
  }

  var DEFAULT_STATUS_OK = 200;
  return nockDef.status || DEFAULT_STATUS_OK;
}

function getScopeFromDefinition(nockDef) {

  //  Backward compatibility for when `port` was part of definition.
  if(!_.isUndefined(nockDef.port)) {
    //  Include `port` into scope if it doesn't exist.
    var options = url.parse(nockDef.scope);
    if(_.isNull(options.port)) {
      return nockDef.scope + ':' + nockDef.port;
    } else {
      if(parseInt(options.port) !== parseInt(nockDef.port)) {
        throw new Error('Mismatched port numbers in scope and port properties of nock definition.');
      }
    }
  }

  return nockDef.scope;
}

function tryJsonParse(string) {
  try {
    return JSON.parse(string);
  } catch(err) {
    return string;
  }
}

function define(nockDefs) {

  var nocks     = [];

  nockDefs.forEach(function(nockDef) {

    var nscope     = getScopeFromDefinition(nockDef)
      , npath      = nockDef.path
      , method     = nockDef.method.toLowerCase() || "get"
      , status     = getStatusFromDefinition(nockDef)
      , headers    = nockDef.headers    || {}
      , reqheaders = nockDef.reqheaders || {}
      , body       = nockDef.body       || ''
      , options    = nockDef.options    || {};

    //  We use request headers for both filtering (see below) and mocking.
    //  Here we are setting up mocked request headers.
    options = _.clone(options) || {};
    options.reqheaders = reqheaders;

    //  Response is not always JSON as it could be a string or binary data or
    //  even an array of binary buffers (e.g. when content is enconded)
    var response;
    if(!nockDef.response) {
      response = '';
    } else {
      response = _.isString(nockDef.response) ? tryJsonParse(nockDef.response) : nockDef.response;
    }

    var nock;
    if(body==="*") {
      nock = startScope(nscope, options).filteringRequestBody(function() {
        return "*";
      })[method](nscope, "*").reply(status, response, headers);
    } else {
      nock = startScope(nscope, options);
      //  If request headers were specified filter by them.
      if(reqheaders !== {}) {
        for (var k in reqheaders) {
          nock.matchHeader(k, reqheaders[k]);
        }
      }
      nock.intercept(npath, method, body).reply(status, response, headers);
    }

    nocks.push(nock);

  });

  return nocks;
}



module.exports = startScope;

module.exports.cleanAll = cleanAll;
module.exports.activate = globalIntercept.activate;
module.exports.isActive = globalIntercept.isActive;
module.exports.disableNetConnect = globalIntercept.disableNetConnect;
module.exports.enableNetConnect = globalIntercept.enableNetConnect;
module.exports.load = load;
module.exports.loadDefs = loadDefs;
module.exports.define = define;
