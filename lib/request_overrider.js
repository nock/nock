'use strict'

const { EventEmitter } = require('events')
const { IncomingMessage, ClientRequest } = require('http')
const propagate = require('propagate')
const DelayedBody = require('./delayed_body')
const common = require('./common')
const Socket = require('./socket')
const _ = require('lodash')
const debug = require('debug')('nock.request_overrider')
const globalEmitter = require('./global_emitter')
const zlib = require('zlib')
const timers = require('timers')

function getHeader(request, name) {
  return request.getHeader(name.toLowerCase())
}

function setHeader(request, name, value) {
  debug('setHeader', name, value)

  request.setHeader(name.toLowerCase(), value)

  if (name == 'expect' && value == '100-continue') {
    timers.setImmediate(function() {
      debug('continue')
      request.emit('continue')
    })
  }
}

//  Sets request headers of the given request. This is needed during both matching phase
//  (in case header filters were specified) and mocking phase (to correctly pass mocked
//  request headers).
function setRequestHeaders(req, options, interceptor) {
  //  If a filtered scope is being used we have to use scope's host
  //  in the header, otherwise 'host' header won't match.
  //  NOTE: We use lower-case header field names throught Nock.
  const HOST_HEADER = 'host'
  if (interceptor.__nock_filteredScope && interceptor.__nock_scopeHost) {
    if (options && options.headers) {
      options.headers[HOST_HEADER] = interceptor.__nock_scopeHost
    }
    setHeader(req, HOST_HEADER, interceptor.__nock_scopeHost)
  } else {
    //  For all other cases, we always add host header equal to the
    //  requested host unless it was already defined.
    if (options.host && !getHeader(req, HOST_HEADER)) {
      let hostHeader = options.host

      if (options.port === 80 || options.port === 443) {
        hostHeader = hostHeader.split(':')[0]
      }

      setHeader(req, HOST_HEADER, hostHeader)
    }
  }
}

function RequestOverrider(req, options, interceptors, remove, cb) {
  const response = new IncomingMessage(new EventEmitter())

  const requestBodyBuffers = []
  let ended
  let headers

  //  We may be changing the options object and we don't want those
  //  changes affecting the user so we use a clone of the object.
  options = _.clone(options)

  response.req = req

  if (options.headers) {
    //  We use lower-case header field names throught Nock.
    options.headers = common.headersFieldNamesToLowerCase(options.headers)

    headers = options.headers
    _.forOwn(headers, function(val, key) {
      setHeader(req, key, val)
    })
  }

  /// options.auth
  if (options.auth && (!options.headers || !options.headers.authorization)) {
    setHeader(
      req,
      'Authorization',
      `Basic ${Buffer.from(options.auth).toString('base64')}`
    )
  }

  if (!req.connection) {
    req.connection = new EventEmitter()
  }

  req.path = options.path

  options.getHeader = function(name) {
    return getHeader(req, name)
  }

  req.socket = response.socket = Socket({ proto: options.proto })

  req.write = function(buffer, encoding, callback) {
    debug('write', arguments)
    if (!req.aborted) {
      if (buffer) {
        if (!Buffer.isBuffer(buffer)) {
          buffer = Buffer.from(buffer, encoding)
        }
        requestBodyBuffers.push(buffer)
      }
      if (typeof callback === 'function') {
        callback()
      }
    } else {
      emitError(new Error('Request aborted'))
    }

    timers.setImmediate(function() {
      req.emit('drain')
    })

    return false
  }

  req.end = function(data, encoding, callback) {
    debug('req.end')
    // TODO Shuffle the arguments for parity with the real `req.end()`.
    // https://github.com/nock/nock/issues/1549
    if (_.isFunction(data) && arguments.length === 1) {
      callback = data
      data = null
    }
    if (!req.aborted && !ended) {
      req.write(data, encoding, function() {
        if (typeof callback === 'function') {
          callback()
        }
        end(cb)
        req.emit('finish')
        req.emit('end')
      })
    }
    if (req.aborted) {
      emitError(new Error('Request aborted'))
    }
  }

  req.flushHeaders = function() {
    debug('req.flushHeaders')
    if (!req.aborted && !ended) {
      end(cb)
    }
    if (req.aborted) {
      emitError(new Error('Request aborted'))
    }
  }

  req.abort = function() {
    if (req.aborted) {
      return
    }
    debug('req.abort')
    req.aborted = Date.now()
    if (!ended) {
      end()
    }
    const err = new Error()
    err.code = 'aborted'
    response.emit('close', err)

    req.socket.destroy()

    req.emit('abort')

    const connResetError = new Error('socket hang up')
    connResetError.code = 'ECONNRESET'
    emitError(connResetError)
  }

  // restify listens for a 'socket' event to be emitted before calling end(),
  // which causes nock to hang with restify. The following logic fakes the
  // socket behavior for restify.
  // Fixes https://github.com/nock/nock/issues/79
  // TODO: This logic doesn't make total sense. It would be helpful to explain
  // in a comment more fully what it is doing. Also it would be helpful to know
  // if the problem in restify persists. In general we should do the standard
  // thing, not implement workarounds for specific other modules.
  // TODO: `req.once()` should not be an alias to `req.on()`. That is
  // extraordinarily confusing behavior.
  req.once = req.on = function(event, listener) {
    // emit a fake socket.
    if (event == 'socket') {
      listener.call(req, req.socket)
      req.socket.emit('connect', req.socket)
      req.socket.emit('secureConnect', req.socket)
    }

    EventEmitter.prototype.on.call(this, event, listener)
    return this
  }

  const emitError = function(error) {
    process.nextTick(function() {
      req.emit('error', error)
    })
  }

  const end = function(cb) {
    debug('ending')
    ended = true
    let requestBody, responseBody, responseBuffers, interceptor

    let continued = false

    //  When request body is a binary buffer we internally use in its hexadecimal representation.
    const requestBodyBuffer = Buffer.concat(requestBodyBuffers)
    const isBinaryRequestBodyBuffer = common.isUtf8Representable(
      requestBodyBuffer
    )
    if (isBinaryRequestBodyBuffer) {
      requestBody = requestBodyBuffer.toString('hex')
    } else {
      requestBody = requestBodyBuffer.toString('utf8')
    }

    /// put back the path into options
    /// because bad behaving agents like superagent
    /// like to change request.path in mid-flight.
    options.path = req.path

    // fixes #976
    options.protocol = `${options.proto}:`

    interceptors.forEach(function(interceptor) {
      //  For correct matching we need to have correct request headers - if these were specified.
      setRequestHeaders(req, options, interceptor)
    })

    interceptor = _.find(interceptors, function(interceptor) {
      return interceptor.match(options, requestBody)
    })

    if (!interceptor) {
      globalEmitter.emit('no match', req, options, requestBody)
      // Try to find a hostname match
      interceptor = _.find(interceptors, function(interceptor) {
        return interceptor.match(options, requestBody, true)
      })
      if (interceptor && req instanceof ClientRequest) {
        if (interceptor.options.allowUnmocked) {
          const newReq = new ClientRequest(options, cb)
          propagate(newReq, req)
          //  We send the raw buffer as we received it, not as we interpreted it.
          newReq.end(requestBodyBuffer)
          return
        }
      }

      const err = new Error(
        `Nock: No match for request ${common.stringifyRequest(
          options,
          requestBody
        )}`
      )
      err.statusCode = err.status = 404
      emitError(err)
      return
    }

    debug('interceptor identified, starting mocking')

    //  We again set request headers, now for our matched interceptor.
    setRequestHeaders(req, options, interceptor)
    interceptor.req = req
    req.headers = req.getHeaders()

    interceptor.scope.emit('request', req, interceptor, requestBody)

    if (typeof interceptor.errorMessage !== 'undefined') {
      interceptor.interceptionCounter++
      remove(interceptor)
      interceptor.discard()

      let error
      if (_.isObject(interceptor.errorMessage)) {
        error = interceptor.errorMessage
      } else {
        error = new Error(interceptor.errorMessage)
      }
      timers.setTimeout(emitError, interceptor.getTotalDelay(), error)
      return
    }
    // TODO-coverage: Either add a test or remove `|| 200` if it's not reachable.
    response.statusCode = Number(interceptor.statusCode) || 200

    // Clone headers/rawHeaders to not override them when evaluating later
    response.headers = _.extend({}, interceptor.headers)
    response.rawHeaders = (interceptor.rawHeaders || []).slice()
    debug('response.rawHeaders:', response.rawHeaders)

    if (typeof interceptor.body === 'function') {
      if (requestBody && common.isJSONContent(req.headers)) {
        if (common.contentEncoding(req.headers, 'gzip')) {
          requestBody = String(zlib.gunzipSync(Buffer.from(requestBody, 'hex')))
        } else if (common.contentEncoding(req.headers, 'deflate')) {
          requestBody = String(
            zlib.inflateSync(Buffer.from(requestBody, 'hex'))
          )
        }

        requestBody = JSON.parse(requestBody)
      }

      // In case we are waiting for a callback
      if (interceptor.body.length === 3) {
        return interceptor.body(
          options.path,
          requestBody || '',
          continueWithResponseBody
        )
      }

      responseBody = interceptor.body(options.path, requestBody) || ''
    } else {
      //  If the content is encoded we know that the response body *must* be an array
      //  of response buffers which should be mocked one by one.
      //  (otherwise decompressions after the first one fails as unzip expects to receive
      //  buffer by buffer and not one single merged buffer)
      if (
        common.isContentEncoded(response.headers) &&
        !common.isStream(interceptor.body)
      ) {
        if (interceptor.delayInMs) {
          // TODO-coverage: Add a test of this error case.
          emitError(
            new Error(
              'Response delay is currently not supported with content-encoded responses.'
            )
          )
          return
        }

        let buffers = interceptor.body
        if (!_.isArray(buffers)) {
          buffers = [buffers]
        }

        responseBuffers = _.map(buffers, function(buffer) {
          return Buffer.from(buffer, 'hex')
        })
      } else {
        responseBody = interceptor.body

        //  If the request was binary then we assume that the response will be binary as well.
        //  In that case we send the response as a Buffer object as that's what the client will expect.
        if (isBinaryRequestBodyBuffer && typeof responseBody === 'string') {
          //  Try to create the buffer from the interceptor's body response as hex.
          try {
            responseBody = Buffer.from(responseBody, 'hex')
          } catch (err) {
            // TODO-coverage: Add a test of this error case.
            debug(
              'exception during Buffer construction from hex data:',
              responseBody,
              '-',
              err
            )
          }

          // Creating buffers does not necessarily throw errors, check for difference in size
          if (
            !responseBody ||
            (interceptor.body.length > 0 && responseBody.length === 0)
          ) {
            //  We fallback on constructing buffer from utf8 representation of the body.
            responseBody = Buffer.from(interceptor.body, 'utf8')
          }
        }
      }
    }

    return continueWithResponseBody(null, responseBody)

    function continueWithResponseBody(err, responseBody) {
      // TODO-coverage: Try to find out when this happens and add a test.
      if (continued) {
        return
      }
      continued = true

      if (err) {
        response.statusCode = 500
        responseBody = err.stack
      }

      //  Transform the response body if it exists (it may not exist
      //  if we have `responseBuffers` instead)

      if (responseBody) {
        debug('transform the response body')

        if (Array.isArray(responseBody)) {
          debug('response body is array: %j', responseBody)

          // TODO-coverage: else, throw an error. Add a test.
          if (!isNaN(Number(responseBody[0]))) {
            response.statusCode = Number(responseBody[0])
          }

          if (responseBody.length >= 2 && responseBody.length <= 3) {
            debug('new headers: %j', responseBody[2])
            _.assign(response.headers, responseBody[2] || {})
            debug('response.headers after: %j', response.headers)
            responseBody = responseBody[1]

            Object.keys(response.headers).forEach(function(key) {
              response.rawHeaders.push(key, response.headers[key])
            })
          }
        }

        if (interceptor.delayInMs) {
          debug(
            'delaying the response for',
            interceptor.delayInMs,
            'milliseconds'
          )
          // Because setTimeout is called immediately in DelayedBody(), so we
          // need count in the delayConnectionInMs.
          responseBody = new DelayedBody(
            interceptor.getTotalDelay(),
            responseBody
          )
        }

        if (common.isStream(responseBody)) {
          debug('response body is a stream')
          responseBody.pause()
          responseBody.on('data', function(d) {
            response.push(d)
          })
          responseBody.on('end', function() {
            response.push(null)
          })
          responseBody.on('error', function(err) {
            // TODO-coverage: Add a test.
            response.emit('error', err)
          })
        } else if (responseBody && !Buffer.isBuffer(responseBody)) {
          if (typeof responseBody === 'string') {
            responseBody = Buffer.from(responseBody)
          } else {
            responseBody = JSON.stringify(responseBody)
            response.headers['content-type'] = 'application/json'
          }
        }
      }

      interceptor.interceptionCounter++
      remove(interceptor)
      interceptor.discard()

      if (req.aborted) {
        return
      }

      // `IncomingMessage.client` is an undocumented alias for
      // `IncomingMessage.socket`. Assigning it here may help with
      // compatibility, including with very old versions of `request` which
      // inspect `response.client.authorized`. Modern versions of request
      // inspect `response.socket.authorized` which is set to true in our
      // `Socket` constructor.
      // https://github.com/nock/nock/issues/158
      // https://github.com/request/request/pull/1615
      // https://nodejs.org/api/http.html#http_response_socket
      // https://github.com/nodejs/node/blob/2e613a9c301165d121b19b86e382860323abc22f/lib/_http_incoming.js#L67
      response.client = response.socket

      // Evaluate functional headers.
      const evaluatedHeaders = {}
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'function') {
          response.headers[key] = evaluatedHeaders[key] = value(
            req,
            response,
            responseBody
          )
        }
      })

      for (
        let rawHeaderIndex = 0;
        rawHeaderIndex < response.rawHeaders.length;
        rawHeaderIndex += 2
      ) {
        const key = response.rawHeaders[rawHeaderIndex]
        const value = response.rawHeaders[rawHeaderIndex + 1]
        if (typeof value === 'function') {
          response.rawHeaders[rawHeaderIndex + 1] =
            evaluatedHeaders[key.toLowerCase()]
        }
      }

      process.nextTick(respond)

      function respond() {
        if (req.aborted) {
          return
        }

        if (interceptor.socketDelayInMs && interceptor.socketDelayInMs > 0) {
          req.socket.applyDelay(interceptor.socketDelayInMs)
        }

        if (
          interceptor.delayConnectionInMs &&
          interceptor.delayConnectionInMs > 0
        ) {
          req.socket.applyDelay(interceptor.delayConnectionInMs)
          setTimeout(_respond, interceptor.delayConnectionInMs)
        } else {
          _respond()
        }

        function _respond() {
          if (req.aborted) {
            return
          }

          debug('emitting response')

          if (typeof cb === 'function') {
            // TODO-coverage: Find out when this happens and add a test.
            debug('callback with response')
            cb(response)
          }

          if (req.aborted) {
            // TODO-coverage: Add a test of this case.
            emitError(new Error('Request aborted'))
          } else {
            req.emit('response', response)
          }

          if (common.isStream(responseBody)) {
            debug('resuming response stream')
            responseBody.resume()
          } else {
            responseBuffers = responseBuffers || []
            if (typeof responseBody !== 'undefined') {
              debug('adding body to buffer list')
              responseBuffers.push(responseBody)
            }

            // Stream the response chunks one at a time.
            timers.setImmediate(function emitChunk() {
              const chunk = responseBuffers.shift()

              if (chunk) {
                debug('emitting response chunk')
                response.push(chunk)
                timers.setImmediate(emitChunk)
              } else {
                debug('ending response stream')
                response.push(null)
                interceptor.scope.emit('replied', req, interceptor)
              }
            })
          }
        }
      }
    }
  }

  return req
}

module.exports = RequestOverrider
