var path = require('path')
  , http = require('http')
  , EventEmitter = require('events').EventEmitter;

var allInterceptors = {};

function addGlobalInterceptor(key, interceptor) {
  if (! allInterceptors.hasOwnProperty(key)) {
    allInterceptors[key] = [];
  }
  allInterceptors[key].push(interceptor);
}

function stringifyRequest(options) {
  var method = options.method || 'GET';
  var path = options.path;
  var body = options.body;
  if (body && typeof(body) !== 'string') {
    body = body.toString();
  }
  return method + ' ' + path + ' ' + body;
}

function processRequest(interceptors, options, callback) {
  var req = new EventEmitter()
    , requestBodyBuffers = []
    , aborted = false
    , end;

  req.write = function(buffer, encoding) {
    if (buffer && !aborted) {
      if (! Buffer.isBuffer(buffer)) {
        buffer = new Buffer(buffer, encoding);
      }
      requestBodyBuffers.push(buffer);
    }
  };
  
  req.end = function(buffer, encoding) {
    if (!aborted) {
      req.write(buffer, encoding);
      end();
      req.emit('end');
    }
  };
  
  req.abort = function() {
    aborted = true;
    end();
    var err = new Error();
    err.code = 'aborted'
    req.emit('close', err);
  };
  
  end = function() {
    var response = new EventEmitter()
      , encoding
      , requestBody
      , responseBody
      , interceptor;

    requestBody = requestBodyBuffers.map(function(buffer) {
      return buffer.toString(encoding);
    }).join('');
    body = undefined; // we don't need the request body buffers any more
    
    interceptors = interceptors.filter(function(interceptor) {
      return interceptor.match(options, requestBody);
    });
    
    if (interceptors.length < 1) { throw new Error("Nock: No match for HTTP request " + stringifyRequest(options)); }
    interceptor = interceptors.splice(0, 1)[0];

    response.statusCode = interceptor.statusCode || 200;
    response.headers = interceptor.headers || {};
    responseBody = interceptor.body;
    if (! Buffer.isBuffer(responseBody)) {
      responseBody = new Buffer(responseBody);
    }
    response.setEncoding = function(newEncoding) {
      encoding = newEncoding;
    };
    interceptor.discard();

    if (aborted) { return; }
    response.pause = function() {};
    response.resume = function() {};
    
    process.nextTick(function() {
      if (typeof callback === 'function') {
        callback(response);
      }
      req.emit('response', response);
      process.nextTick(function() {
        if (encoding) {
          responseBody = responseBody.toString(encoding);
        }
        response.emit('data', responseBody);
        process.nextTick(function() {
          response.emit('end');
        });
      });
    });
  };
  
  return req;
}

var httpRequest = http.request;

http.request = function(options, callback) {
  var basePath = 'http://' + options.host
    , interceptors = allInterceptors[basePath];
  
  if (interceptors && interceptors.length > 0) {
    return processRequest(interceptors, options, callback);
  } else {
    return httpRequest.apply(http, arguments);
  }
};

module.exports = addGlobalInterceptor;
