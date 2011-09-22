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

function processRequest(interceptors, options, callback) {
  var req = new EventEmitter()
    , requestBodyBuffers = [];

  req.write = function(buffer, encoding) {
    if (buffer) {
      if (! Buffer.isBuffer(buffer)) {
        buffer = new Buffer(buffer, encoding);
      }
      requestBodyBuffers.push(buffer);
    }
  };
  
  req.end = function(buffer) {
    req.write(buffer);
    req.emit('end');
  };
  
  req.on('end', function() {
    var response = new EventEmitter()
      , encoding
      , requestBody
      , responseBody
      , interceptor;
      
    requestBody = requestBodyBuffers.map(function(buffer) {
      buffer.toString(encoding);
    }).join('');
    body = undefined; // we don't need the request body buffers any more

    interceptors = interceptors.filter(function(interceptor) {
      return interceptor.match(options, requestBody);
    });
    
    if (interceptors.length < 1) { throw new Error("Nock: No match for HTTP request " + JSON.stringify(options)); }
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
    
    process.nextTick(function() {
      callback(response);
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
  });
  
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