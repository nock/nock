var path = require('path')
  , http = require('http')
  , url  = require('url')
  , EventEmitter = require('events').EventEmitter;

var allInterceptors = {};

function addGlobalInterceptor(key, interceptor) {
  if (! allInterceptors.hasOwnProperty(key)) {
    allInterceptors[key] = [];
  }
  allInterceptors[key].push(interceptor);
}


function remove(interceptor) {
  var key = interceptor._key.split(' ');
  var u = url.parse(key[1]);
  var hostKey = u.protocol + '//' + u.host;
  var interceptors = allInterceptors[hostKey];
  var interceptor;
  
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
  var method = options.method || 'GET';
  var path = options.path;
  var body = options.body;
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
  var req = new EventEmitter()
    , response = new EventEmitter()
    , requestBodyBuffers = []
    , aborted
    , end
    , ended;

  if (options.headers) {
    var headers = options.headers;
    var keys = Object.keys(headers);

    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];

      setHeader(req, key, headers[key]);
    };
  }

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
    var encoding
      , requestBody
      , responseBody
      , interceptor
      , paused
      , next = []
      , callnext;

    requestBody = requestBodyBuffers.map(function(buffer) {
      return buffer.toString(encoding);
    }).join('');
    body = undefined; // we don't need the request body buffers any more
    
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

    response.pipe = function(dest, options) {
      var source = this;

      function ondata(chunk) {
        if (dest.writable) {
          if (false === dest.write(chunk)) source.pause();
        }
      }

      function ondrain() {
        if (source.readable) source.resume();
      }

      source.on('data', ondata);
      dest.on('drain', ondrain);

      // If the 'end' option is not supplied, dest.end() will be called when
      // source gets the 'end' or 'close' events.  Only dest.end() once, and
      // only when all sources have ended.
      if (!options || options.end !== false) {
        dest._pipeCount = dest._pipeCount || 0;
        dest._pipeCount++;

        source.on('end', onend);
        source.on('close', onclose);
      }

      var didOnEnd = false;
      function onend() {
        if (didOnEnd) return;
        didOnEnd = true;

        dest._pipeCount--;

        // remove the listeners
        cleanup();

        if (dest._pipeCount > 0) {
          // waiting for other incoming streams to end.
          return;
        }

        dest.end();
      }


      function onclose() {
        if (didOnEnd) return;
        didOnEnd = true;

        dest._pipeCount--;

        // remove the listeners
        cleanup();

        if (dest._pipeCount > 0) {
          // waiting for other incoming streams to end.
          return;
        }

        dest.destroy();
      }

      // don't leave dangling pipes when there are errors.
      function onerror(er) {
        cleanup();
        if (this.listeners('error').length === 0) {
          throw er; // Unhandled stream error in pipe.
        }
      }

      source.on('error', onerror);
      dest.on('error', onerror);

      // guarantee that source streams can be paused and resumed, even
      // if the only effect is to proxy the event back up the pipe chain.
      if (!source.pause) {
        source.pause = function() {
          source.emit('pause');
        };
      }

      if (!source.resume) {
        source.resume = function() {
          source.emit('resume');
        };
      }

      function onpause() {
        source.pause();
      }

      dest.on('pause', onpause);

      function onresume() {
        if (source.readable) source.resume();
      }

      dest.on('resume', onresume);

      // remove all the event listeners that were added.
      function cleanup() {
        source.removeListener('data', ondata);
        dest.removeListener('drain', ondrain);

        source.removeListener('end', onend);
        source.removeListener('close', onclose);

        dest.removeListener('pause', onpause);
        dest.removeListener('resume', onresume);

        source.removeListener('error', onerror);
        dest.removeListener('error', onerror);

        source.removeListener('end', cleanup);
        source.removeListener('close', cleanup);

        dest.removeListener('end', cleanup);
        dest.removeListener('close', cleanup);
      }

      source.on('end', cleanup);
      source.on('close', cleanup);

      dest.on('end', cleanup);
      dest.on('close', cleanup);

      dest.emit('pipe', source);
    };

    next.push(function() {
      if (encoding) {
        responseBody = responseBody.toString(encoding);
      }
      response.emit('data', responseBody);
    });

    next.push(function() {
      response.emit('end');
    });

    callnext = function() {
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

var httpRequest = http.request;

http.request = function(options, callback) {
  var basePath = 'http://' + options.host
    , interceptors = allInterceptors[basePath];
  
  if (interceptors) {
    return processRequest(interceptors, options, callback);
  } else {
    return httpRequest.apply(http, arguments);
  }
};

module.exports = addGlobalInterceptor;
