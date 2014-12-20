'use strict';

var EventEmitter     = require('events').EventEmitter,
    http             = require('http'),
    propagate        = require('propagate'),
    DelayedBody      = require('./delayed_body'),
    OutgoingMessage  = http.OutgoingMessage,
    ClientRequest    = http.ClientRequest,
    common           = require('./common'),
    Socket           = require('./socket'),
    _                = require('lodash'),
    debug            = require('debug')('nock.request_overrider'),
    timers           = require('timers');

function getHeader(request, name) {
  if (!request._headers) {
    return;
  }

  var key = name.toLowerCase();

  return request._headers[key];
}

function setHeader(request, name, value) {
  debug('setHeader', name, value);
  var key = name.toLowerCase();

  request._headers = request._headers || {};
  request._headerNames = request._headerNames || {};
  request._removedHeader = request._removedHeader || {};

  request._headers[key] = value;
  request._headerNames[key] = name;

  if (name == 'expect' && value == '100-continue') {
    timers.setImmediate(function() {
      request.emit('continue');
    });
  }
}

function isStream(obj) {
  var is = obj && (typeof obj !== 'string') && (!Buffer.isBuffer(obj)) && (typeof obj.setEncoding === 'function');
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

  //  If a filtered scope is being used we have to use scope's host
  //  in the header, otherwise 'host' header won't match.
  //  NOTE: We use lower-case header field names throught Nock.
  var HOST_HEADER = 'host';
  if(interceptor.__nock_filteredScope && interceptor.__nock_scopeHost) {
    if(options && options.headers) {
      options.headers[HOST_HEADER] = interceptor.__nock_scopeHost;
    }
    setHeader(req, HOST_HEADER, interceptor.__nock_scopeHost);
  } else {
    //  For all other cases, we always add host header equal to the
    //  requested host unless it was already defined.
    if (options.host && !getHeader(req, HOST_HEADER)) {
      var hostHeader = options.host;

      if (options.port === 80 || options.port === 443) {
        hostHeader = hostHeader.split(':')[0];
      }

      setHeader(req, HOST_HEADER, hostHeader);
    }
  }

}

function RequestOverrider(req, options, interceptors, remove, cb) {

  var response = new OutgoingMessage(new EventEmitter()),
      requestBodyBuffers = [],
      originalInterceptors = interceptors,
      aborted,
      emitError,
      end,
      ended,
      headers,
      keys,
      key,
      i,
      l;

  //  We may be changing the options object and we don't want those
  //  changes affecting the user so we use a clone of the object.
  options = _.clone(options) || {};

  response.req = req;

  if (options.headers) {
    //  We use lower-case header field names throught Nock.
    options.headers = common.headersFieldNamesToLowerCase(options.headers);

    headers = options.headers;
    keys = Object.keys(headers);

    for (i = 0, l = keys.length; i < l; i++) {
      key = keys[i];

      setHeader(req, key, headers[key]);
    }
  }

  /// options.auth
  if (options.auth && (! options.headers || ! options.headers.authorization)) {
    setHeader(req, 'Authorization', 'Basic ' + (new Buffer(options.auth)).toString('base64'));
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

  req.socket = Socket();

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

  // restify listens for a 'socket' event to
  // be emitted before calling end(), which causes
  // nock to hang with restify. The following logic
  // fakes the socket behavior for restify,
  // Fixes: https://github.com/pgte/nock/issues/79
  req.once = req.on = function(event, listener) {
    // emit a fake socket.
    if (event == 'socket') {
      listener(req.socket);
      req.socket.emit('connect', req.socket);
      req.socket.emit('secureConnect', req.socket);
    }

    EventEmitter.prototype.on.call(this, event, listener);
    return this;
  };

  emitError = function(error) {
    process.nextTick(function () {
      req.emit('error', error);
    });
  };

  end = function(cb) {
    ended = true;
    var encoding,
        requestBody,
        responseBody,
        responseBuffers,
        interceptor,
        paused,
        mockEmits = [];

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

      emitError(new Error("Nock: No match for request " + common.stringifyRequest(options, requestBody)));
      return;
    }

    debug('interceptor identified, starting mocking');

    interceptor = interceptors.shift();

    response.statusCode = interceptor.statusCode || 200;
    response.headers = interceptor.headers || {};

    //  We again set request headers, now for our matched interceptor.
    setRequestHeaders(req, options, interceptor);

    if (typeof interceptor.body === 'function') {

      responseBody = interceptor.body(options.path, requestBody) || '';

    } else {

      //  If the content is encoded we know that the response body *must* be an array
      //  of response buffers which should be mocked one by one.
      //  (otherwise decompressions after the first one fails as unzip expects to receive
      //  buffer by buffer and not one single merged buffer)
      if(common.isContentEncoded(response.headers) && ! isStream(interceptor.body)) {

        if (interceptor.delayInMs) {
          emitError(new Error('Response delay is currently not supported with content-encoded responses.'));
          return;
        }

        var buffers = interceptor.body;
        if(!_.isArray(buffers)) {
          emitError(
            new Error(
              'content-encoded response must be an array of binary buffers and not ' + typeof(buffers)));
          return;
        }

        responseBuffers = _.map(buffers, function(buffer) {
          return new Buffer(buffer, 'hex');
        });

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
    }

    //  Transform the response body if it exists (it may not exist if we have `responseBuffers` instead)
    if(responseBody) {
      debug('transform the response body');

      if (!Buffer.isBuffer(responseBody) && !isStream(responseBody)) {
        if (typeof responseBody === 'string') {
          responseBody = new Buffer(responseBody);
        } else {
          responseBody = JSON.stringify(responseBody);
        }
      }

      if (interceptor.delayInMs) {
        debug('delaying the response for', interceptor.delayInMs, 'milliseconds');
        responseBody = new DelayedBody(interceptor.delayInMs, responseBody);
      }

      if (isStream(responseBody)) {
        debug('response body is a stream');
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
      } else if (responseBody && !Buffer.isBuffer(responseBody)) {
        if (typeof responseBody === 'string') {
          responseBody = new Buffer(responseBody);
        } else {
          responseBody = JSON.stringify(responseBody);
          response.headers['content-type'] = 'application/json';
        }
      }
    }

    remove(interceptor);
    interceptor.discard();

    if (aborted) { return; }

    response.setEncoding = function(newEncoding) {
      encoding = newEncoding;
    };

    response.pause = function() {
      debug('pausing mocking');
      paused = true;
      if (isStream(responseBody)) {
        responseBody.pause();
      }
    };

    response.resume = function() {
      debug('resuming mocking');
      paused = false;
      if (isStream(responseBody)) {
        responseBody.resume();
      }
      mockNextEmit();
    };

    var read = false;
    response.read = function() {
      debug('reading response body');
      if (isStream(responseBody) && responseBody.read) {
        return responseBody.read();
      } else {
        if (! read) {
          read = true;
          return responseBody;
        } else {
          return null;
        }
      }
    };

    //  HACK: Flag our response object as readable so that it can be automatically
    //    resumed by Node when drain happens. This enables working with some agents
    //    that behave differently than built-in agent (e.g. needle, superagent).
    //    The correct way to implement this would be to use IncomingMessage instead
    //    of OutgoingMessage class to mock responses.
    response.readable = true;

    /// response.client.authorized = true
    /// fixes https://github.com/pgte/nock/issues/158
    response.client = _.extend(response.client || {}, {
      authorized: true
    });

    //  `mockEmits` is an array of emits to be performed during mocking.
    if (typeof responseBody !== "undefined") {
      mockEmits.push(function() {
        if (encoding) {
          debug('transforming body per its encoding');
          if (isStream(responseBody)) {
            responseBody.setEncoding(encoding);
          } else {
            responseBody = responseBody.toString(encoding);
          }
        }
        if (! isStream(responseBody)) {
          debug('emitting response body');
          response.emit('data', responseBody);
          response.emit('readable');
        }
      });
    } else {
      //  We will emit response buffers one by one.
      _.each(responseBuffers, function(buffer) {
        mockEmits.push(function() {
          debug('emitting response buffer');
          response.emit('data', buffer);
          response.emit('readable');
        });
      });
    }

    if (!isStream(responseBody)) {
      mockEmits.push(function() {
        debug('emitting end');
        response.emit('end');
      });
    }

    function mockNextEmit() {
      debug('mocking next emit');

      //  We don't use `process.nextTick` because we *want* (very much so!)
      //  for I/O to happen before the next `emit` since we are precisely mocking I/O.
      //  Otherwise the writing to output pipe may stall invoking pause()
      //  without ever calling resume() (the observed was behavior on superagent
      //  with Node v0.10.26)
      timers.setImmediate(function() {
        if (paused || mockEmits.length === 0 || aborted) {
          debug('mocking paused, aborted or finished');
          return;
        }

        var nextMockEmit = mockEmits.shift();
        nextMockEmit();

        //  Recursively invoke to mock the next emit after the last one was handled.
        mockNextEmit();
      });
    }

    debug('mocking', mockEmits.length, 'emits');

    process.nextTick(function() {
      var respond = function() {
        debug('emitting response');

        if (typeof cb === 'function') {
          debug('callback with response');
          cb(response);
        }

        req.emit('response', response);

        if (isStream(responseBody)) {
          debug('resuming response stream');
          responseBody.resume();
        }

        mockNextEmit();
      };

      if (interceptor.delayConnectionInMs && interceptor.delayConnectionInMs > 0) {
        setTimeout(respond, interceptor.delayConnectionInMs);
      } else {
        respond();
      }
    });
  };

  return req;
}

module.exports = RequestOverrider;
