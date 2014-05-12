var EventEmitter     = require('events').EventEmitter,
    http             = require('http'),
    propagate        = require('propagate'),
    DelayedBody      = require('./delayed_body'),
    OutgoingMessage  = http.OutgoingMessage,
    ClientRequest    = http.ClientRequest,
    common           = require('./common'),
    _                = require('lodash'),
    debug            = require('debug')('nock.request_overrider');

function getHeader(request, name) {
  if (!request._headers) {
    return;
  }

  var key = name.toLowerCase();

  return request._headers[key];
}

function setHeader(request, name, value) {
  var key = name.toLowerCase();

  request._headers = request._headers || {};
  request._headerNames = request._headerNames || {};
  request._removedHeader = request._removedHeader || {};

  request._headers[key] = value;
  request._headerNames[key] = name;
}

function isStream(obj) {
  var is = obj && (typeof a !== 'string') && (! Buffer.isBuffer(obj)) && (typeof obj.setEncoding === 'function');
  return is;
}

//  Sets request headers of the given request. This is needed during both matching phase
//  (in case header filters were specified) and mocking phase (to correctly pass mocked
//  request headers).
function setRequestHeaders(req, options, interceptor) {
  //  We mock request headers if these were specified.
  if (interceptor.reqheaders) {
    var reqheaders = interceptor.reqheaders;
    _(interceptor.reqheaders).keys().each(function(key) {
      setHeader(req, key, reqheaders[key]);
    });
  }

  //  We always add host header equal to the requested host unless it was already defined.
  var HOST_HEADER = 'host';
  if (options.host && !getHeader(req, HOST_HEADER)) {
    var hostHeader = options.host;

    if (options.port === 80 || options.port === 443) {
      hostHeader = hostHeader.split(':')[0];
    }

    setHeader(req, HOST_HEADER, hostHeader);
  }
}

function RequestOverrider(req, options, interceptors, remove, cb) {
  var response = new OutgoingMessage(new EventEmitter()),
      requestBodyBuffers = [],
      originalInterceptors = interceptors,
      aborted,
      end,
      ended,
      headers,
      keys,
      key,
      i,
      l;

  response.req = req;

  if (options.headers) {
    headers = options.headers;
    keys = Object.keys(headers);

    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i];

      setHeader(req, key, headers[key]);
    }
  }

  // Mock response.connection and request.connection
  // Fixes: https://github.com/flatiron/nock/issues/74
  if (! response.connection) {
    response.connection = new EventEmitter();
  }

  if (! req.connection) {
    req.connection = new EventEmitter();
  }

  req.path = options.path;

  options.getHeader = function(name) {
    return getHeader(req, name);
  };

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
      end(cb);
      req.emit('finish');
      req.emit('end');
    }
  };

  req.abort = function() {
    aborted = true;
    if (!ended) {
      end();
    }
    var err = new Error();
    err.code = 'aborted';
    response.emit('close', err);
  };

  end = function(cb) {
    ended = true;
    var encoding,
        requestBody,
        responseBody,
        interceptor,
        paused,
        next = [];

    //  When request body is a binary buffer we internally use in its hexadecimal representation.
    var requestBodyBuffer = common.mergeChunks(requestBodyBuffers);
    var isBinaryRequestBodyBuffer = common.isBinaryBuffer(requestBodyBuffer);
    if(isBinaryRequestBodyBuffer) {
      requestBody = requestBodyBuffer.toString('hex');
    } else {
      requestBody = requestBodyBuffer.toString('utf8');
    }

    /// put back the path into options
    /// because bad behaving agents like superagent
    /// like to change request.path in mid-flight.
    options.path = req.path;

    interceptors = interceptors.filter(function(interceptor) {
      //  For correct matching we need to have correct request headers - if these were specified.
      setRequestHeaders(req, options, interceptor);

      return interceptor.match(options, requestBody);
    });

    if (interceptors.length < 1) {
      // Try to find a hostname match
      interceptors = originalInterceptors.filter(function(interceptor) {
        return interceptor.match(options, requestBody, true);
      });
      if (interceptors.length && req instanceof ClientRequest) {
        interceptor = interceptors[0];
        if (interceptor.options.allowUnmocked) {
          var newReq = new ClientRequest(options, cb);
          propagate(newReq, req);
          //  We send the raw buffer as we received it, not as we interpreted it.
          newReq.end(requestBodyBuffer);
          return;
        }
      }
      throw new Error("Nock: No match for request " + common.stringifyRequest(options, requestBody));
    }

    interceptor = interceptors.shift();

    response.statusCode = interceptor.statusCode || 200;
    response.headers = interceptor.headers || {};

    //  We again set request headers, now for our matched interceptor.
    setRequestHeaders(req, options, interceptor);

    if (typeof interceptor.body === 'function') {
      responseBody = interceptor.body(options.path, requestBody) || '';
    } else {
      responseBody = interceptor.body;

      //  If the request was binary then we assume that the response will be binary as well.
      //  In that case we send the response as a Buffer object as that's what the client will expect.
      if(isBinaryRequestBodyBuffer && typeof(responseBody) === 'string') {
        //  Try to create the buffer from the interceptor's body response as hex.
        try {
          responseBody = new Buffer(responseBody, 'hex');
        } catch(err) {
          debug('exception during Buffer construction from hex data:', responseBody, '-', err);
        }

        // Creating buffers does not necessarily throw errors, check for difference in size
        if (!responseBody || (interceptor.body.length > 0 && responseBody.length === 0)) {
          //  We fallback on constructing buffer from utf8 representation of the body.
          responseBody = new Buffer(interceptor.body, 'utf8');
        }
      }
    }

    if (responseBody && !Buffer.isBuffer(responseBody) && !isStream(responseBody)) {
      if (typeof responseBody === 'string') {
        responseBody = new Buffer(responseBody);
      } else {
        responseBody = JSON.stringify(responseBody);
      }
    }

    if (interceptor.delayInMs) {
      responseBody = new DelayedBody(interceptor.delayInMs, responseBody);
    }

    if (isStream(responseBody)) {
      responseBody.pause();
      responseBody.on('data', function(d) {
        response.emit('data', d);
      });
      responseBody.on('end', function() {
        response.emit('end');
      });
      responseBody.on('error', function(err) {
        response.emit('error', err);
      });
    } else  if (responseBody && !Buffer.isBuffer(responseBody)) {
      if (typeof responseBody === 'string') {
        responseBody = new Buffer(responseBody);
      } else {
        responseBody = JSON.stringify(responseBody);
        response.headers['content-type'] = 'application/json';
      }
    }

    response.setEncoding = function(newEncoding) {
      encoding = newEncoding;
    };
    remove(interceptor);
    interceptor.discard();

    if (aborted) { return; }

    response.pause = function() {
      paused = true;
      if (isStream(responseBody)) {
        responseBody.pause();
      }
    };

    response.resume = function() {
      paused = false;
      if (isStream(responseBody)) {
        responseBody.resume();
      }
      callnext();
    };

    var read = false;
    response.read = function() {
      if (isStream(responseBody) && responseBody.read) {
        return responseBody.read();
      } else if (! read) {
        read = true;
        return responseBody;
      }
    };

    if (typeof responseBody !== "undefined") {
      next.push(function() {
        if (encoding) {
          if (isStream(responseBody)) {
            responseBody.setEncoding(encoding);
          } else {
            responseBody = responseBody.toString(encoding);
          }
        }
        if (! isStream(responseBody)) {
          response.emit('data', responseBody);
          response.emit('readable');
        }
      });
    }

    if (! isStream(responseBody)) {
      next.push(function() {
        response.emit('end');
      });
    }

    function callnext() {
      process.nextTick(function() {
      if (paused || next.length === 0 || aborted) { return; }
        next.shift()();
        callnext();
      });
    }

    process.nextTick(function() {
      var respond = function(){
        if (typeof cb === 'function') {
          cb(response);
        }
        req.emit('response', response);
        if (isStream(responseBody)) {
          responseBody.resume();
        }
        callnext();
      };

      if (interceptor.delayConnectionInMs && interceptor.delayConnectionInMs > 0) {
        setTimeout(respond, interceptor.delayConnectionInMs);
      }else{
        respond();
      }
    });
  };

  return req;
}

module.exports = RequestOverrider;
