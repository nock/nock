var Piper = require('./piper')
    path = require('path'),
    url  = require('url')
    EventEmitter = require('events').EventEmitter;

var allInterceptors = {};

function addGlobalInterceptor(key, interceptor) {
  if (! allInterceptors.hasOwnProperty(key)) {
    allInterceptors[key] = [];
  }
  allInterceptors[key].push(interceptor);
}


function remove(interceptor) {
  var key          = interceptor._key.split(' '),
      u            = url.parse(key[1]),
      hostKey      = u.protocol + '//' + u.host,
      interceptors = allInterceptors[hostKey],
      interceptor,
      thisInterceptor;
  
  for(var i = 0; i < interceptors.length; i++) {
    thisInterceptor = interceptors[i];
    if (thisInterceptor._key === interceptor._key) {
      interceptors.splice(i, 1);
      break;
    }
  }
  //if (! interceptors) { delete allInterceptors[hostKey]; }
}

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

function processRequest(interceptors, options, callback) {
  var req = new EventEmitter(),
      response = new EventEmitter(),
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
      if (paused || next.length === 0 || aborted) { return; }
      process.nextTick(function() {
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


// ----- Overriding http.request and https.request:

[ 'http', 'https'].forEach(
  function(proto) {

    var moduleName = proto, // 1 to 1 match of protocol and module is fortunate :)
        module = require(moduleName),
        oldRequest = module.request;
        
    module.request = function overridenRequest(options, callback) {

      if (!options.host) {
        options.host = options.hostname;
        if (options.port)
          options.host += ":" + options.port;
      }
      options.proto = proto;
      
      var basePath =  proto + '://' + options.host
        , interceptors = allInterceptors[basePath];
        
      if (interceptors) {
        return processRequest(interceptors, options, callback);
      } else {
        return oldRequest.apply(module, arguments);
      }

    };
  }
);


module.exports = addGlobalInterceptor;
