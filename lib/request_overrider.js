var Piper            = require('./piper'),
    EventEmitter     = require('events').EventEmitter;

function stringifyRequest(options) {
  var method = options.method || 'GET',
      path = options.path,
      body = options.body;

  if (body && typeof(body) !== 'string') {
    body = body.toString();
  }
  return method + ' ' + path + ' ' + body;
}

function getHeader(request, name) {
  if (!request._headers) return;

  var key = name.toLowerCase();

  return request._headers[key];
}

function setHeader(request, name, value) {
  var key = name.toLowerCase();

  request._headers = request._headers || {};
  request._headerNames = request._headerNames || {};
  request._headers[key] = value;
  request._headerNames[key] = name;
}

function RequestOverrider(req, options, interceptors, remove) {
  var response = new EventEmitter(),
      requestBodyBuffers = [],
      aborted,
      end,
      ended,
      headers,
      keys,
      key,
      i;

  if (options.headers) {
    headers = options.headers;
    keys = Object.keys(headers);

    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i];

      setHeader(req, key, headers[key]);
    };
  }

  options.getHeader = function(name) {
    return getHeader(req, name);
  };

  if (options.host && !getHeader(req, 'host')) {
    var hostHeader = options.host;

    if (options.host && +options.port !== 80) {
      hostHeader += ':' + options.port;
    }

    setHeader(req, 'Host', hostHeader);
  }

  req.write = function(buffer, encoding) {
    if (buffer && !aborted) {
      if (! Buffer.isBuffer(buffer)) {
        buffer = new Buffer(buffer, encoding);
      }
      requestBodyBuffers.push(buffer);
    }
  };
  
  req.end = function(buffer, encoding) {
    if (!aborted && !ended) {
      req.write(buffer, encoding);
      end();
      req.emit('end');
    }
  };
  
  req.abort = function() {
    aborted = true;
    if (!ended) {
      end();
    }
    var err = new Error();
    err.code = 'aborted'
    response.emit('close', err);
  };
  
  end = function() {
    ended = true;
    var encoding,
        requestBody,
        responseBody,
        interceptor,
        paused,
        next = [];

    var requestBodySize = 0;
    var copyTo = 0;
    requestBodyBuffers.forEach(function(b) {
      requestBodySize += b.length;
    });
    requestBody = new Buffer(requestBodySize);
    requestBodyBuffers.forEach(function(b) {
    b.copy(requestBody, copyTo);
      copyTo += b.length;
    });
    
    requestBody = requestBody.toString();
    
    interceptors = interceptors.filter(function(interceptor) {
      return interceptor.match(options, requestBody);
    });
    
    if (interceptors.length < 1) { throw new Error("Nock: No match for HTTP request " + stringifyRequest(options)); }
    interceptor = interceptors.shift();

    response.statusCode = interceptor.statusCode || 200;
    response.headers = interceptor.headers || {};
    response.readable = true;
    responseBody = interceptor.body;
    if (! Buffer.isBuffer(responseBody)) {
      responseBody = new Buffer(responseBody);
    }
    response.setEncoding = function(newEncoding) {
      encoding = newEncoding;
    };
    remove(interceptor);
    interceptor.discard();

    if (aborted) { return; }

    response.pause = function() {
      paused = true;
    };

    response.resume = function() {
      paused = false;
      callnext();
    };

    response.pipe = Piper();
    next.push(function() {
      if (encoding) {
        responseBody = responseBody.toString(encoding);
      }
      response.emit('data', responseBody);
    });

    next.push(function() {
      response.emit('end');
    });

    function callnext() {
      process.nextTick(function() {
      if (paused || next.length === 0 || aborted) { return; }
        next.shift()();
        callnext();
      });
    };
    
    process.nextTick(function() {
      if (typeof callback === 'function') {
        callback(response);
      }
      req.emit('response', response);
      callnext();
    });
  };
  
  return req;
}

module.exports = RequestOverrider;