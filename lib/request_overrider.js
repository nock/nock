'use strict';

var EventEmitter     = require('events').EventEmitter,
    http             = require('http'),
    propagate        = require('propagate'),
    DelayedBody      = require('./delayed_body'),
    IncomingMessage  = http.IncomingMessage,
    ClientRequest    = http.ClientRequest,
    common           = require('./common'),
    Socket           = require('./socket'),
    _                = require('lodash'),
    debug            = require('debug')('nock.request_overrider'),
    timers           = require('timers'),
    ReadableStream   = require('stream').Readable,
    globalEmitter    = require('./global_emitter'),
    zlib             = require('zlib');

function getHeader(request, name) {
  if (!request._headers) {
    return;
  }

  var key = name.toLowerCase();

  return request.getHeader ? request.getHeader(key) : request._headers[key];
}

function setHeader(request, name, value) {
  debug('setHeader', name, value);

  var key = name.toLowerCase();

  request._headers = request._headers || {};
  request._headerNames = request._headerNames || {};
  request._removedHeader = request._removedHeader || {};

  if (request.setHeader) {
    request.setHeader(key, value);
  } else {
    request._headers[key] = value;
    request._headerNames[key] = name;
  }

  if (name == 'expect' && value == '100-continue') {
    timers.setImmediate(function() {
      debug('continue');
      request.emit('continue');
    });
  }
}

//  Sets request headers of the given request. This is needed during both matching phase
//  (in case header filters were specified) and mocking phase (to correctly pass mocked
//  request headers).
function setRequestHeaders(req, options, interceptor) {
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
  var response;
  if (IncomingMessage) {
    response = new IncomingMessage(new EventEmitter());
  } else {
    response = new ReadableStream();
    response._read = function() {};
  }

  var requestBodyBuffers = [],
      aborted,
      emitError,
      end,
      ended,
      headers;

  //  We may be changing the options object and we don't want those
  //  changes affecting the user so we use a clone of the object.
  options = _.clone(options) || {};

  response.req = req;

  if (options.headers) {
    //  We use lower-case header field names throught Nock.
    options.headers = common.headersFieldNamesToLowerCase(options.headers);

    headers = options.headers;
    _.forOwn(headers, function(val, key) {
      setHeader(req, key, val);
    });
  }

  /// options.auth
  if (options.auth && (! options.headers || ! options.headers.authorization)) {
    setHeader(req, 'Authorization', 'Basic ' + (new Buffer(options.auth)).toString('base64'));
  }

  if (! req.connection) {
    req.connection = new EventEmitter();
  }

  req.path = options.path;

  options.getHeader = function(name) {
    return getHeader(req, name);
  };

  req.socket = response.socket = Socket({ proto: options.proto });

  req.write = function(buffer, encoding) {
    debug('write', arguments);
    if (buffer && !aborted) {
      if (! Buffer.isBuffer(buffer)) {
        buffer = new Buffer(buffer, encoding);
      }
      requestBodyBuffers.push(buffer);
    }
    if (aborted) {
      emitError(new Error('Request aborted'));
    }

    timers.setImmediate(function() {
      req.emit('drain');
    });

    return false;
  };

  req.end = function(buffer, encoding) {
    debug('req.end');
    if (!aborted && !ended) {
      req.write(buffer, encoding);
      end(cb);
      req.emit('finish');
      req.emit('end');
    }
    if (aborted) {
      emitError(new Error('Request aborted'));
    }
  };

  req.flushHeaders = function() {
    debug('req.flushHeaders');
    if (!aborted && !ended) {
      end(cb);
    }
    if (aborted) {
      emitError(new Error('Request aborted'));
    }
  };

  req.abort = function() {
    if (aborted) {
      return;
    }
    debug('req.abort');
    aborted = true;
    if (!ended) {
      end();
    }
    var err = new Error();
    err.code = 'aborted';
    response.emit('close', err);

    req.socket.destroy();

    req.emit('abort');

    var connResetError = new Error('socket hang up');
    connResetError.code = 'ECONNRESET';
    emitError(connResetError);
  };

  // restify listens for a 'socket' event to
  // be emitted before calling end(), which causes
  // nock to hang with restify. The following logic
  // fakes the socket behavior for restify,
  // Fixes: https://github.com/pgte/nock/issues/79
  req.once = req.on = function(event, listener) {
    // emit a fake socket.
    if (event == 'socket') {
      listener.call(req, req.socket);
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
    debug('ending');
    ended = true;
    var requestBody,
        responseBody,
        responseBuffers,
        interceptor;

    var continued = false;

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

    // fixes #976
    options.protocol = options.proto + ':';

    interceptors.forEach(function(interceptor) {
      //  For correct matching we need to have correct request headers - if these were specified.
      setRequestHeaders(req, options, interceptor);
    });

    interceptor = _.find(interceptors, function(interceptor) {
      return interceptor.match(options, requestBody);
    });

    if (!interceptor) {
      globalEmitter.emit('no match', req, options, requestBody);
      // Try to find a hostname match
      interceptor = _.find(interceptors, function(interceptor) {
        return interceptor.match(options, requestBody, true);
      });
      if (interceptor && req instanceof ClientRequest) {
        if (interceptor.options.allowUnmocked) {
          var newReq = new ClientRequest(options, cb);
          propagate(newReq, req);
          //  We send the raw buffer as we received it, not as we interpreted it.
          newReq.end(requestBodyBuffer);
          return;
        }
      }

      var err = new Error("Nock: No match for request " + common.stringifyRequest(options, requestBody));
      err.statusCode = err.status = 404;
      emitError(err);
      return;
    }

    debug('interceptor identified, starting mocking');

    //  We again set request headers, now for our matched interceptor.
    setRequestHeaders(req, options, interceptor);
    interceptor.req = req;
    req.headers = req.getHeaders ? req.getHeaders() : req._headers;

    interceptor.scope.emit('request', req, interceptor);

    if (typeof interceptor.errorMessage !== 'undefined') {
      interceptor.interceptionCounter++;
      remove(interceptor);
      interceptor.discard();

      var error;
      if (_.isObject(interceptor.errorMessage)) {
        error = interceptor.errorMessage;
      } else {
        error = new Error(interceptor.errorMessage);
      }
      timers.setTimeout(emitError, interceptor.getTotalDelay(), error);
      return;
    }
    response.statusCode = Number(interceptor.statusCode) || 200;

    // Clone headers/rawHeaders to not override them when evaluating later
    response.headers = _.extend({}, interceptor.headers);
    response.rawHeaders = (interceptor.rawHeaders || []).slice();
    debug('response.rawHeaders:', response.rawHeaders);


    if (typeof interceptor.body === 'function') {
      if (requestBody && common.isJSONContent(options.headers)) {
        if (requestBody && common.contentEncoding(options.headers, 'gzip')) {
          if (typeof zlib.gunzipSync !== 'function') {
            emitError(new Error('Gzip encoding is currently not supported in this version of Node.'));
            return;
          }
          requestBody = String(zlib.gunzipSync(new Buffer(requestBody, 'hex')), 'hex')
        } else if (requestBody && common.contentEncoding(options.headers, 'deflate')) {
          if (typeof zlib.deflateSync !== 'function') {
            emitError(new Error('Deflate encoding is currently not supported in this version of Node.'));
            return;
          }
          requestBody = String(zlib.inflateSync(new Buffer(requestBody, 'hex')), 'hex')
        }

        requestBody = JSON.parse(requestBody);
      }

      // In case we are waiting for a callback
      if (interceptor.body.length === 3) {
        return interceptor.body(options.path, requestBody || '', continueWithResponseBody);
      }

      responseBody = interceptor.body(options.path, requestBody) || '';

    } else {

      //  If the content is encoded we know that the response body *must* be an array
      //  of response buffers which should be mocked one by one.
      //  (otherwise decompressions after the first one fails as unzip expects to receive
      //  buffer by buffer and not one single merged buffer)
      if(common.isContentEncoded(response.headers) && ! common.isStream(interceptor.body)) {

        if (interceptor.delayInMs) {
          emitError(new Error('Response delay is currently not supported with content-encoded responses.'));
          return;
        }

        var buffers = interceptor.body;
        if(!_.isArray(buffers)) {
          buffers = [buffers];
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

    return continueWithResponseBody(null, responseBody);

    function continueWithResponseBody(err, responseBody) {

      if (continued) {
        return;
      }
      continued = true;

      if (err) {
        response.statusCode = 500;
        responseBody = err.stack;
      }

      //  Transform the response body if it exists (it may not exist
      //  if we have `responseBuffers` instead)

      if (responseBody) {
        debug('transform the response body');

        if (Array.isArray(responseBody) &&
            responseBody.length >= 2 &&
            responseBody.length <= 3 &&
            typeof responseBody[0] == 'number')
        {
          debug('response body is array: %j', responseBody);
          response.statusCode = Number(responseBody[0]);
          debug('new headers: %j', responseBody[2]);
          if (! response.headers) response.headers = {};
          _.assign(response.headers, responseBody[2] || {});
          debug('response.headers after: %j', response.headers);
          responseBody = responseBody[1];

          response.rawHeaders = response.rawHeaders || [];
          Object.keys(response.headers).forEach(function(key) {
            response.rawHeaders.push(key, response.headers[key]);
          });
        }

        if (interceptor.delayInMs) {
          debug('delaying the response for', interceptor.delayInMs, 'milliseconds');
          // Because setTimeout is called immediately in DelayedBody(), so we
          // need count in the delayConnectionInMs.
          responseBody = new DelayedBody(interceptor.getTotalDelay(), responseBody);
        }

        if (common.isStream(responseBody)) {
          debug('response body is a stream');
          responseBody.pause();
          responseBody.on('data', function(d) {
            response.push(d);
          });
          responseBody.on('end', function() {
            response.push(null);
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

      interceptor.interceptionCounter++;
      remove(interceptor);
      interceptor.discard();

      if (aborted) { return; }

      /// response.client.authorized = true
      /// fixes https://github.com/pgte/nock/issues/158
      response.client = _.extend(response.client || {}, {
        authorized: true
      });

      // Account for updates to Node.js response interface
      // cf https://github.com/request/request/pull/1615
      response.socket = _.extend(response.socket || {}, {
        authorized: true
      });

      // Evaluate functional headers.
      var evaluatedHeaders = {}
      Object.keys(response.headers).forEach(function (key) {
        var value = response.headers[key];

        if (typeof value === "function") {
          response.headers[key] = evaluatedHeaders[key] = value(req, response, responseBody);
        }
      });

      for(var rawHeaderIndex = 0 ; rawHeaderIndex < response.rawHeaders.length ; rawHeaderIndex += 2) {
        var key = response.rawHeaders[rawHeaderIndex];
        var value = response.rawHeaders[rawHeaderIndex + 1];
        if (typeof value === "function") {
          response.rawHeaders[rawHeaderIndex + 1] = evaluatedHeaders[key.toLowerCase()];
        }
      }


      process.nextTick(respond);

      function respond() {

        if (aborted) { return; }

        if (interceptor.socketDelayInMs && interceptor.socketDelayInMs > 0) {
          req.socket.applyDelay(interceptor.socketDelayInMs);
        }

        if (interceptor.delayConnectionInMs && interceptor.delayConnectionInMs > 0) {
          setTimeout(_respond, interceptor.delayConnectionInMs);
        } else {
          _respond();
        }

        function _respond() {
          if (aborted) { return; }

          debug('emitting response');

          if (typeof cb === 'function') {
            debug('callback with response');
            cb(response);
          }

          if (aborted) {
            emitError(new Error('Request aborted'));
          }
          else {
            req.emit('response', response);
          }

          if (common.isStream(responseBody)) {
            debug('resuming response stream');
            responseBody.resume();
          }
          else {
            responseBuffers = responseBuffers || [];
            if (typeof responseBody !== "undefined") {
              debug('adding body to buffer list');
              responseBuffers.push(responseBody);
            }

            // Stream the response chunks one at a time.
            timers.setImmediate(function emitChunk() {
              var chunk = responseBuffers.shift();

              if (chunk) {
                debug('emitting response chunk');
                response.push(chunk);
                timers.setImmediate(emitChunk);
              }
              else {
                debug('ending response stream');
                response.push(null);
                interceptor.scope.emit('replied', req, interceptor);
              }
            });
          }
        }
      }
    }
  };

  return req;
}

module.exports = RequestOverrider;
