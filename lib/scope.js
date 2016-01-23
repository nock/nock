/* jshint strict:false */
/**
 * @module nock/scope
 */
var globalIntercept = require('./intercept')
  , mixin           = require('./mixin')
  , matchBody       = require('./match_body')
  , common          = require('./common')
  , assert          = require('assert')
  , url             = require('url')
  , _               = require('lodash')
  , debug           = require('debug')('nock.scope')
  , stringify       = require('json-stringify-safe')
  , EventEmitter    = require('events').EventEmitter
  , extend          = require('util')._extend
  , globalEmitter   = require('./global_emitter')
  , util = require('util') ;

var fs;

try {
  fs = require('fs');
} catch(err) {
  // do nothing, we're in the browser
}

function isStream(obj) {
  return (typeof obj !== 'undefined') &&
         (typeof a !== 'string') &&
         (! Buffer.isBuffer(obj)) &&
         _.isFunction(obj.setEncoding);
}

function startScope(basePath, options) {
  return new Scope(basePath, options);
}

function Scope(basePath, options) {
  if (!(this instanceof Scope)) {
    return new Scope(basePath, options);
  }

  EventEmitter.apply(this);
  this.keyedInterceptors = {};
  this.interceptors = [];
  //this.scope = null;
  this.transformPathFunction = null;
  this.transformRequestBodyFunction = null;
  this.matchHeaders = [];
  this.logger = debug;
  this.scopeOptions = options || {};
  this.urlParts = {};
  this._persist = false;
  this.contentLen = false;
  this.date = null;
  this.basePath = basePath;
  this.basePathname = '';
  this.port = null;

  if (!(basePath instanceof RegExp)) {
    this.urlParts = url.parse(basePath);
    this.port = this.urlParts.port || ((this.urlParts.protocol === 'http:') ? 80 : 443);
    this.basePathname = this.urlParts.pathname.replace(/\/$/, '');
    this.basePath = this.urlParts.protocol + '//' + this.urlParts.hostname + ':' + this.port;
  }
}

util.inherits(Scope, EventEmitter);

Scope.prototype.add = function add(key, interceptor, scope) {
  if (! this.keyedInterceptors.hasOwnProperty(key)) {
    this.keyedInterceptors[key] = [];
  }
  this.keyedInterceptors[key].push(interceptor);
  globalIntercept(this.basePath,
      interceptor,
      this,
      this.scopeOptions,
      this.urlParts.hostname);
};

Scope.prototype.remove = function remove(key, interceptor) {
  if (this._persist) {
    return;
  }
  var arr = this.keyedInterceptors[key];
  if (arr) {
    arr.splice(arr.indexOf(interceptor), 1);
    if (arr.length === 0) {
      delete this.keyedInterceptors[key];
    }
  }
};

Scope.prototype.intercept = function intercept(uri, method, requestBody, interceptorOptions) {
  var ic = new Interceptor(this, uri, method, requestBody, interceptorOptions);

  this.interceptors.push(ic);
  return ic;
};

Scope.prototype.get = function get(uri, requestBody, options) {
  return this.intercept(uri, 'GET', requestBody, options);
};

Scope.prototype.post = function post(uri, requestBody, options) {
  return this.intercept(uri, 'POST', requestBody, options);
};

Scope.prototype.put = function put(uri, requestBody, options) {
  return this.intercept(uri, 'PUT', requestBody, options);
};

Scope.prototype.head = function head(uri, requestBody, options) {
  return this.intercept(uri, 'HEAD', requestBody, options);
};

Scope.prototype.patch = function patch(uri, requestBody, options) {
  return this.intercept(uri, 'PATCH', requestBody, options);
};

Scope.prototype.merge = function merge(uri, requestBody, options) {
  return this.intercept(uri, 'MERGE', requestBody, options);
};

Scope.prototype.delete = function _delete(uri, requestBody, options) {
  return this.intercept(uri, 'DELETE', requestBody, options);
};

Scope.prototype.pendingMocks = function pendingMocks() {
  return Object.keys(this.keyedInterceptors);
};

Scope.prototype.isDone = function isDone() {
  var self = this;
  // if nock is turned off, it always says it's done
  if (! globalIntercept.isOn()) { return true; }

  var keys = Object.keys(this.keyedInterceptors);
  if (keys.length === 0) {
    return true;
  } else {
    var doneHostCount = 0;

    keys.forEach(function(key) {
      var doneInterceptorCount = 0;

      self.keyedInterceptors[key].forEach(function(interceptor) {
        var isRequireDoneDefined = !_.isUndefined(interceptor.options.requireDone);
        if (isRequireDoneDefined && interceptor.options.requireDone === false) {
          doneInterceptorCount += 1;
        } else if (self._persist && interceptor.interceptionCounter > 0) {
          doneInterceptorCount += 1;
        }
      });

      if (doneInterceptorCount === self.keyedInterceptors[key].length ) {
        doneHostCount += 1;
      }
    });
    return (doneHostCount === keys.length);
  }
};

Scope.prototype.done = function done() {
  assert.ok(this.isDone(), "Mocks not yet satisfied:\n" + this.pendingMocks().join("\n"));
};

Scope.prototype.buildFilter = function buildFilter() {
  var filteringArguments = arguments;

  if (arguments[0] instanceof RegExp) {
    return function(candidate) {
      if (candidate) {
        candidate = candidate.replace(filteringArguments[0], filteringArguments[1]);
      }
      return candidate;
    };
  } else if (_.isFunction(arguments[0])) {
    return arguments[0];
  }
};

Scope.prototype.filteringPath = function filteringPath() {
  this.transformPathFunction = this.buildFilter.apply(this, arguments);
  if (!this.transformPathFunction) {
    throw new Error('Invalid arguments: filtering path should be a function or a regular expression');
  }
  return this;
};

Scope.prototype.filteringRequestBody = function filteringRequestBody() {
  this.transformRequestBodyFunction = this.buildFilter.apply(this, arguments);
  if (!this.transformRequestBodyFunction) {
    throw new Error('Invalid arguments: filtering request body should be a function or a regular expression');
  }
  return this;
};

Scope.prototype.matchHeader = function matchHeader(name, value) {
  //  We use lower-case header field names throughout Nock.
  this.matchHeaders.push({ name: name.toLowerCase(), value: value });
  return this;
};

Scope.prototype.defaultReplyHeaders = function defaultReplyHeaders(headers) {
  this._defaultReplyHeaders = common.headersFieldNamesToLowerCase(headers);
  return this;
};

Scope.prototype.log = function log(newLogger) {
  this.logger = newLogger;
  return this;
};

Scope.prototype.persist = function persist() {
  this._persist = true;
  return this;
};

Scope.prototype.shouldPersist = function shouldPersist() {
  return this._persist;
};

Scope.prototype.replyContentLength = function replyContentLength() {
  this.contentLen = true;
  return this;
};

Scope.prototype.replyDate = function replyDate(d) {
  this.date = d || new Date();
  return this;
};

function Interceptor(scope, uri, method, requestBody, interceptorOptions) {
  this.scope = scope;
  this.interceptorMatchHeaders = [];
  this.method = method.toUpperCase();
  this.uri = uri;
  this._key = this.method + ' ' + scope.basePath + scope.basePathname + uri;
  this.basePath = this.scope.basePath;
  this.path = (typeof uri === 'string') ? scope.basePathname + uri : uri;

  this.baseUri = this.method + ' ' + scope.basePath + scope.basePathname;
  this.options = interceptorOptions || {};
  this.counter = 1;
  this._requestBody = requestBody;

  //  We use lower-case header field names throughout Nock.
  this.reqheaders = common.headersFieldNamesToLowerCase((scope.scopeOptions && scope.scopeOptions.reqheaders) || {});
  this.badheaders = common.headersFieldsArrayToLowerCase((scope.scopeOptions && scope.scopeOptions.badheaders) || []);
}

Interceptor.prototype.replyWithError = function replyWithError(errorMessage) {
  this.errorMessage = errorMessage;

  for (var opt in this.scope.scopeOptions) {
    if (_.isUndefined(this.options[opt])) {
      this.options[opt] = this.scope.scopeOptions[opt];
    }
  }

  this.scope.add(this._key, this, this.scope, this.scopeOptions);
  return this.scope;
};

Interceptor.prototype.reply = function reply(statusCode, body, headers) {
  if (arguments.length <= 2 && _.isFunction(statusCode)) {
    body = statusCode;
    statusCode = 200;
  }

  this.statusCode = statusCode;

  //  We use lower-case headers throughout Nock.
  headers = common.headersFieldNamesToLowerCase(headers);

//  this.options = interceptorOptions || {};
  for (var opt in this.scope.scopeOptions) {
    if (_.isUndefined(this.options[opt])) {
      this.options[opt] = this.scope.scopeOptions[opt];
    }
  }

  if (this.scope._defaultReplyHeaders) {
    headers = headers || {};
    headers = mixin(this.scope._defaultReplyHeaders, headers);
  }

  if (this.scope.date) {
    headers = headers || {};
    headers['date'] = this.scope.date.toUTCString();
  }

  if (headers !== undefined) {
    this.headers = {};
    this.rawHeaders = [];

    // makes sure all keys in headers are in lower case
    for (var key2 in headers) {
      if (headers.hasOwnProperty(key2)) {
        this.headers[key2.toLowerCase()] = headers[key2];
        this.rawHeaders.push(key2);
        this.rawHeaders.push(headers[key2]);
      }
    }
    debug('reply.rawHeaders:', this.rawHeaders);
  }

  //  If the content is not encoded we may need to transform the response body.
  //  Otherwise we leave it as it is.
  if (!common.isContentEncoded(headers)) {
    if (body && typeof(body) !== 'string' &&
        typeof(body) !== 'function' &&
        !Buffer.isBuffer(body) &&
        !isStream(body)) {
      try {
        body = stringify(body);
        if (!this.headers) {
          this.headers = {};
        }
        if (!this.headers['content-type']) {
          this.headers['content-type'] = 'application/json';
        }
        if (this.scope.contentLen) {
          this.headers['content-length'] = body.length;
        }
      } catch(err) {
        throw new Error('Error encoding response body into JSON');
      }
    }
  }

  this.body = body;

  this.scope.add(this._key, this, this.scope, this.scopeOptions);
  return this.scope;
};

Interceptor.prototype.replyWithFile = function replyWithFile(statusCode, filePath, headers) {
  if (! fs) {
    throw new Error('No fs');
  }
  var readStream = fs.createReadStream(filePath);
  readStream.pause();
  this.filePath = filePath;
  return this.reply(statusCode, readStream, headers);
};

Interceptor.prototype.replyWithFile = function replyWithFile(statusCode, filePath, headers) {
  if (! fs) {
    throw new Error('No fs');
  }
  var readStream = fs.createReadStream(filePath);
  readStream.pause();
  this.filePath = filePath;
  return this.reply(statusCode, readStream, headers);
};


// Also match request headers
// https://github.com/pgte/nock/issues/163
Interceptor.prototype.reqheaderMatches = function reqheaderMatches(options, key) {
  //  We don't try to match request headers if these weren't even specified in the request.
  if (! options.headers) {
    return true;
  }

  var reqHeader = this.reqheaders[key];
  var header = options.headers[key];
  if (header && (typeof header !== 'string') && header.toString) {
    header = header.toString();
  }

  //  We skip 'host' header comparison unless it's available in both mock and actual request.
  //  This because 'host' may get inserted by Nock itself and then get recorder.
  //  NOTE: We use lower-case header field names throughout Nock.
  if (key === 'host' &&
      (_.isUndefined(header) ||
      _.isUndefined(reqHeader)))
  {
    return true;
  }

  if (reqHeader && header) {
    if (_.isFunction(reqHeader)) {
      return reqHeader(header);
    } else if (common.matchStringOrRegexp(header, reqHeader)) {
      return true;
    }
  }

  debug('request header field doesn\'t match:', key, header, reqHeader);
  return false;
};

Interceptor.prototype.match = function match(options, body, hostNameOnly) {
  debug('match %s, body = %s', stringify(options), stringify(body));
  if (hostNameOnly) {
    return options.hostname === this.scope.urlParts.hostname;
  }

  var method = (options.method || 'GET').toUpperCase()
      , path = options.path
      , matches
      , matchKey
      , proto = options.proto;

  if (this.scope.transformPathFunction) {
    path = this.scope.transformPathFunction(path);
  }
  if (typeof(body) !== 'string') {
    body = body.toString();
  }
  if (this.scope.transformRequestBodyFunction) {
    body = this.scope.transformRequestBodyFunction(body, this._requestBody);
  }

  var checkHeaders = function(header) {
    if (_.isFunction(header.value)) {
      return header.value(options.getHeader(header.name));
    }
    return common.matchStringOrRegexp(options.getHeader(header.name), header.value);
  };

  if (!this.scope.matchHeaders.every(checkHeaders) ||
      !this.interceptorMatchHeaders.every(checkHeaders)) {
    this.scope.logger('headers don\'t match');
    return false;
  }

  var reqHeadersMatch =
      ! this.reqheaders ||
      Object.keys(this.reqheaders).every(this.reqheaderMatches.bind(this, options));

  if (!reqHeadersMatch) {
    return false;
  }

  function reqheaderContains(header) {
    return _.has(options.headers, header);
  }

  var reqContainsBadHeaders =
      this.badheaders &&
      _.some(this.badheaders, reqheaderContains);

  if (reqContainsBadHeaders) {
    return false;
  }

  //  If we have a filtered scope then we use it instead reconstructing
  //  the scope from the request options (proto, host and port) as these
  //  two won't necessarily match and we have to remove the scope that was
  //  matched (vs. that was defined).
  if (this.__nock_filteredScope) {
    matchKey = this.__nock_filteredScope;
  } else {
    matchKey = proto + '://' + options.host;
    if (
        options.port && options.host.indexOf(':') < 0 &&
        (options.port !== 80 || options.proto !== 'http') &&
        (options.port !== 443 || options.proto !== 'https')
    ) {
      matchKey += ":" + options.port;
    }
  }

  // Match query strings when using query()
  var matchQueries = true;
  var queryIndex = -1;
  var queries;

  if (this.queries && (queryIndex = path.indexOf('?')) !== -1) {
    queries = path.slice(queryIndex + 1).split('&');
    queries = queries.filter(function(str) {
      return str.length > 0;
    });

    // Only check for query string matches if this.queries is an object
    if (_.isObject(this.queries)) {
      // Make sure that you have an equal number of keys. We are
      // looping through the passed query params and not the expected values
      // if the user passes fewer query params than expected but all values
      // match this will throw a false positive. Testing that the length of the
      // passed query params is equal to the length of expected keys will prevent
      // us from doing any value checking BEFORE we know if they have all the proper
      // params
      debug('this.queries: %j', this.queries);
      debug('queries: %j', queries);
      if (Object.keys(this.queries).length !== queries.length) {
        matchQueries = false;
      } else {
        for (var i = 0; i < queries.length; i++) {
          var query = queries[i].split('=');

          if (query[1] === undefined || this.queries[ query[0] ] === undefined) {
            matchQueries = false;
            break;
          }

          var isMatch = common.matchStringOrRegexp(query[1], this.queries[ query[0] ]);
          matchQueries = matchQueries && !!isMatch;
        }
      }
      debug('matchQueries: %j', matchQueries);
    }

    // Remove the query string from the path
    path = path.substr(0, queryIndex);
  }

  if (typeof this.uri === 'function') {
    matches = matchQueries &&
      method.toUpperCase() + ' ' + proto + '://' + options.host === this.baseUri &&
      this.uri.call(this, path);
  } else {
    matches = method === this.method &&
      common.matchStringOrRegexp(matchKey, this.basePath) &&
      common.matchStringOrRegexp(path, this.path) &&
      matchQueries;
  }

  // special logger for query()
  if (queryIndex !== -1) {
    this.scope.logger('matching ' + matchKey + '?' + queries.join('&') + ' to ' + this._key +
    ' with query(' + stringify(this.queries) + '): ' + matches);
  } else {
    this.scope.logger('matching ' + matchKey + ' to ' + this._key + ': ' + matches);
  }

  if (matches) {
    matches = (matchBody.call(options, this._requestBody, body));
    if (!matches) {
      this.scope.logger('bodies don\'t match: \n', this._requestBody, '\n', body);
    }
  }

  return matches;
};

Interceptor.prototype.matchIndependentOfBody = function matchIndependentOfBody(options) {
  var method = (options.method || 'GET').toUpperCase()
    , path = options.path
    , proto = options.proto;

  if (this.scope.transformPathFunction) {
    path = this.scope.transformPathFunction(path);
  }

  var checkHeaders = function(header) {
    return options.getHeader && common.matchStringOrRegexp(options.getHeader(header.name), header.value);
  };

  if (!this.scope.matchHeaders.every(checkHeaders) ||
      !this.interceptorMatchHeaders.every(checkHeaders)) {
    return false;
  }

  var matchKey = method + ' ' + proto + '://' + options.host + path;
  return this._key === matchKey;
};

Interceptor.prototype.filteringPath = function filteringPath() {
  if (_.isFunction(arguments[0])) {
    this.scope.transformFunction = arguments[0];
  }
  return this;
};

Interceptor.prototype.discard = function discard() {
  if ((this.scope.shouldPersist() || this.counter > 0) && this.filePath) {
    this.body = fs.createReadStream(this.filePath);
    this.body.pause();
  }

  if (!this.scope.shouldPersist() && this.counter < 1) {
    this.scope.remove(this._key, this);
  }
};

Interceptor.prototype.matchHeader = function matchHeader(name, value) {
  this.interceptorMatchHeaders.push({ name: name, value: value });
  return this;
};

Interceptor.prototype.basicAuth = function basicAuth(options) {
  var username = options['user'];
  var password = options['pass'] || '';
  var name = 'authorization';
  var value = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
  this.interceptorMatchHeaders.push({ name: name, value: value });
  return this;
};

/**
 * Set query strings for the interceptor
 * @name query
 * @param Object Object of query string name,values (accepts regexp values)
 * @public
 * @example
 * // Will match 'http://zombo.com/?q=t'
 * nock('http://zombo.com').get('/').query({q: 't'});
 */
Interceptor.prototype.query = function query(queries) {
  this.queries = this.queries || {};

  // Allow all query strings to match this route
  if (queries === true) {
    this.queries = queries;
  }

  for (var q in queries) {
    if (_.isUndefined(this.queries[q])) {
      var value = queries[q];

      switch (true) {
      case _.isNumber(value): // fall-though
      case _.isBoolean(value):
        value = value.toString();
        break;
      case _.isUndefined(value): // fall-though
      case _.isNull(value):
        value = '';
        break;
      case _.isString(value):
        if (!this.scope.scopeOptions.encodedQueryParams) value = common.percentEncode(value);
        break;
      }

      if (!this.scope.scopeOptions.encodedQueryParams) q = common.percentEncode(q);

      // everything else, incl. Strings and RegExp values are used 'as-is'
      this.queries[q] = value;
    }
  }

  return this;
};

/**
 * Set number of times will repeat the interceptor
 * @name times
 * @param Integer Number of times to repeat (should be > 0)
 * @public
 * @example
 * // Will repeat mock 5 times for same king of request
 * nock('http://zombo.com).get('/').times(5).reply(200, 'Ok');
*/
Interceptor.prototype.times = function times(newCounter) {
  if (newCounter < 1) {
    return this;
  }

  this.counter = newCounter;

  return this;
};

/**
 * An sugar syntax for times(1)
 * @name once
 * @see {@link times}
 * @public
 * @example
 * nock('http://zombo.com).get('/').once.reply(200, 'Ok');
*/
Interceptor.prototype.once = function once() {
  return this.times(1);
};

/**
 * An sugar syntax for times(2)
 * @name twice
 * @see {@link times}
 * @public
 * @example
 * nock('http://zombo.com).get('/').twice.reply(200, 'Ok');
*/
Interceptor.prototype.twice = function twice() {
  return this.times(2);
};

/**
 * An sugar syntax for times(3).
 * @name thrice
 * @see {@link times}
 * @public
 * @example
 * nock('http://zombo.com).get('/').thrice.reply(200, 'Ok');
*/
Interceptor.prototype.thrice = function thrice() {
  return this.times(3);
};

/**
 * Delay the response by a certain number of ms.
 *
 * @param  {integer} ms - Number of milliseconds to wait
 * @return {scope} - the current scope for chaining
 */
Interceptor.prototype.delay = function delay(ms) {
  this.delayInMs = ms;
  return this;
};

/**
 * Delay the connection by a certain number of ms.
 *
 * @param  {integer} ms - Number of milliseconds to wait
 * @return {scope} - the current scope for chaining
 */
Interceptor.prototype.delayConnection = function delayConnection(ms) {
  this.delayConnectionInMs = ms;
  return this;
};

/**
 * Make the socket idle for a certain number of ms (simulated).
 *
 * @param  {integer} ms - Number of milliseconds to wait
 * @return {scope} - the current scope for chaining
 */
Interceptor.prototype.socketDelay = function socketDelay(ms) {
  this.socketDelayInMs = ms;
  return this;
};



function cleanAll() {
  globalIntercept.removeAll();
  return module.exports;
}

function loadDefs(path) {
  if (! fs) {
    throw new Error('No fs');
  }

  var contents = fs.readFileSync(path);
  return JSON.parse(contents);
}

function load(path) {
  return define(loadDefs(path));
}

function getStatusFromDefinition(nockDef) {
  //  Backward compatibility for when `status` was encoded as string in `reply`.
  if (!_.isUndefined(nockDef.reply)) {
    //  Try parsing `reply` property.
    var parsedReply = parseInt(nockDef.reply, 10);
    if (_.isNumber(parsedReply)) {
      return parsedReply;
    }
  }

  var DEFAULT_STATUS_OK = 200;
  return nockDef.status || DEFAULT_STATUS_OK;
}

function getScopeFromDefinition(nockDef) {

  //  Backward compatibility for when `port` was part of definition.
  if (!_.isUndefined(nockDef.port)) {
    //  Include `port` into scope if it doesn't exist.
    var options = url.parse(nockDef.scope);
    if (_.isNull(options.port)) {
      return nockDef.scope + ':' + nockDef.port;
    } else {
      if (parseInt(options.port) !== parseInt(nockDef.port)) {
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
    //  Here we are setting up mocked request headers but we don't want to
    //  be changing the user's options object so we clone it first.
    options = _.clone(options) || {};
    options.reqheaders = reqheaders;

    //  Response is not always JSON as it could be a string or binary data or
    //  even an array of binary buffers (e.g. when content is enconded)
    var response;
    if (!nockDef.response) {
      response = '';
    } else {
      response = _.isString(nockDef.response) ? tryJsonParse(nockDef.response) : nockDef.response;
    }

    var nock;
    if (body==="*") {
      nock = startScope(nscope, options).filteringRequestBody(function() {
        return "*";
      })[method](npath, "*").reply(status, response, headers);
    } else {
      nock = startScope(nscope, options);
      //  If request headers were specified filter by them.
      if (reqheaders !== {}) {
        for (var k in reqheaders) {
          nock.matchHeader(k, reqheaders[k]);
        }
      }
      if (nockDef.filteringRequestBody) {
        nock.filteringRequestBody(nockDef.filteringRequestBody);
      }
      nock.intercept(npath, method, body).reply(status, response, headers);
    }

    nocks.push(nock);

  });

  return nocks;
}

module.exports = extend(startScope, {
  cleanAll: cleanAll,
  activate: globalIntercept.activate,
  isActive: globalIntercept.isActive,
  isDone: globalIntercept.isDone,
  pendingMocks: globalIntercept.pendingMocks,
  removeInterceptor: globalIntercept.removeInterceptor,
  disableNetConnect: globalIntercept.disableNetConnect,
  enableNetConnect: globalIntercept.enableNetConnect,
  load: load,
  loadDefs: loadDefs,
  define: define,
  emitter: globalEmitter,
});
