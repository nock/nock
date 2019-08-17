'use strict'

const debug = require('debug')('nock.request_overrider')
const { EventEmitter } = require('events')
const {
  IncomingMessage,
  ClientRequest,
  request: originalHttpRequest,
} = require('http')
const { request: originalHttpsRequest } = require('https')
const _ = require('lodash')
const propagate = require('propagate')
const timers = require('timers')
const util = require('util')
const zlib = require('zlib')

const common = require('./common')
const DelayedBody = require('./delayed_body')
const globalEmitter = require('./global_emitter')
const Socket = require('./socket')

function getHeader(request, name) {
  return request.getHeader(name.toLowerCase())
}

function setHeader(request, name, value) {
  debug('setHeader', name, value)

  request.setHeader(name.toLowerCase(), value)

  // https://github.com/nock/nock/issues/256
  if (name === 'expect' && value === '100-continue') {
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
  //  NOTE: We use lower-case header field names throughout Nock.
  const HOST_HEADER = 'host'
  if (interceptor.__nock_filteredScope && interceptor.__nock_scopeHost) {
    options.headers[HOST_HEADER] = interceptor.__nock_scopeHost
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

function emitError(req, error) {
  process.nextTick(() => {
    req.emit('error', error)
  })
}

/**
 * Liaise between an outgoing request and a group of interceptors. Consume the
 * request itself, and idenfity which interceptor ought to respond, if any,
 * delegating to an instance of InterceptorPlayback.
 */
class InterceptedRequestBroker {
  constructor({ req, options, interceptors }) {
    this.options = {
      // We may be changing the options object and we don't want those changes
      // affecting the user so we use a clone of the object.
      ...options,
      // We use lower-case header field names throughout Nock.
      headers: common.headersFieldNamesToLowerCase(options.headers || {}),
    }

    this.interceptors = interceptors

    this.response = new IncomingMessage(new EventEmitter())
    this.playbackStarted = false
    this.requestBodyBuffers = []

    this.attachToReq(req)
  }

  attachToReq(req) {
    this.response.req = this.req = req

    const { options } = this

    for (const [name, val] of Object.entries(options.headers)) {
      setHeader(req, name, val)
    }

    if (options.auth && !options.headers.authorization) {
      setHeader(
        req,
        'Authorization',
        `Basic ${Buffer.from(options.auth).toString('base64')}`
      )
    }

    req.path = options.path
    req.method = options.method

    options.getHeader = name => getHeader(req, name)

    // ClientRequest.connection is an alias for ClientRequest.socket
    // https://nodejs.org/api/http.html#http_request_socket
    // https://github.com/nodejs/node/blob/b0f75818f39ed4e6bd80eb7c4010c1daf5823ef7/lib/_http_client.js#L640-L641
    // IncomingMessage.connection & IncomingMessage.client are aliases for IncomingMessage.socket
    // https://nodejs.org/api/http.html#http_response_socket
    // https://github.com/nodejs/node/blob/b0f75818f39ed4e6bd80eb7c4010c1daf5823ef7/lib/_http_incoming.js#L44-L69
    // The same Socket is shared between the request and response to mimic native behavior.
    req.socket = req.connection = new Socket({ proto: options.proto })
    this.response.socket = this.response.client = this.response.connection =
      req.socket

    propagate(['error', 'timeout'], req.socket, req)

    req.write = (...args) => this.handleWrite(...args)
    req.end = (...args) => this.handleEnd(...args)
    req.flushHeaders = (...args) => this.handleFlushHeaders(...args)
    req.abort = (...args) => this.handleAbort(...args)

    // Emit a fake socket event on the next tick to mimic what would happen on a real request.
    // Some clients listen for a 'socket' event to be emitted before calling end(),
    // which causes nock to hang.
    process.nextTick(() => {
      req.emit('socket', req.socket)

      // https://nodejs.org/api/net.html#net_event_connect
      req.socket.emit('connect')

      // https://nodejs.org/api/tls.html#tls_event_secureconnect
      if (req.socket.authorized) {
        req.socket.emit('secureConnect')
      }
    })
  }

  emitError(error) {
    emitError(this.req, error)
  }

  handleWrite(buffer, encoding, callback) {
    debug('write', arguments)
    const { req } = this

    if (!req.aborted) {
      if (buffer) {
        if (!Buffer.isBuffer(buffer)) {
          buffer = Buffer.from(buffer, encoding)
        }
        this.requestBodyBuffers.push(buffer)
      }
      if (typeof callback === 'function') {
        callback()
      }
    } else {
      this.emitError(new Error('Request aborted'))
    }

    timers.setImmediate(function() {
      req.emit('drain')
    })

    return false
  }

  handleEnd(chunk, encoding, callback) {
    debug('req.end')
    const { req } = this

    if (typeof chunk === 'function') {
      callback = chunk
      chunk = null
    } else if (typeof encoding === 'function') {
      callback = encoding
      encoding = null
    }

    if (!req.aborted && !this.playbackStarted) {
      req.write(chunk, encoding, () => {
        if (typeof callback === 'function') {
          callback()
        }
        this.startPlayback()
        req.emit('finish')
        req.emit('end')
      })
    }
    if (req.aborted) {
      this.emitError(new Error('Request aborted'))
    }
  }

  handleFlushHeaders() {
    debug('req.flushHeaders')
    const { req } = this

    if (!req.aborted && !this.playbackStarted) {
      this.startPlayback()
    }
    if (req.aborted) {
      this.emitError(new Error('Request aborted'))
    }
  }

  handleAbort() {
    debug('req.abort')
    const { req, response } = this

    if (req.aborted) {
      return
    }
    req.aborted = Date.now()
    if (!this.playbackStarted) {
      this.startPlayback()
    }
    const err = new Error()
    err.code = 'aborted'
    response.emit('close', err)

    req.socket.destroy()

    req.emit('abort')

    const connResetError = new Error('socket hang up')
    connResetError.code = 'ECONNRESET'
    this.emitError(connResetError)
  }

  startPlayback() {
    debug('ending')
    this.playbackStarted = true

    const { req, response, options, interceptors } = this

    Object.assign(options, {
      // Re-update `options` with the current value of `req.path` because badly
      // behaving agents like superagent like to change `req.path` mid-flight.
      path: req.path,
      // similarly, node-http-proxy will modify headers in flight, so we have
      // to put the headers back into options.
      headers: req.getHeaders(),
      // Fixes https://github.com/nock/nock/issues/976
      protocol: `${options.proto}:`,
    })

    interceptors.forEach(interceptor => {
      // For correct matching we need to have correct request headers - if
      // these were specified.
      setRequestHeaders(req, options, interceptor)
    })

    const requestBodyBuffer = Buffer.concat(this.requestBodyBuffers)
    // When request body is a binary buffer we internally use in its hexadecimal
    // representation.
    const isBinaryRequestBodyBuffer = common.isUtf8Representable(
      requestBodyBuffer
    )
    const requestBodyString = requestBodyBuffer.toString(
      isBinaryRequestBodyBuffer ? 'hex' : 'utf8'
    )

    const matchedInterceptor = interceptors.find(i =>
      i.match(options, requestBodyString)
    )

    if (matchedInterceptor) {
      debug('interceptor identified, starting mocking')

      new InterceptorPlayback({
        req,
        options,
        requestBodyString,
        isBinaryRequestBodyBuffer,
        response,
        interceptor: matchedInterceptor,
      }).start()
    } else {
      globalEmitter.emit('no match', req, options, requestBodyString)

      // Try to find a hostname match that allows unmocked.
      const allowUnmocked = interceptors.some(
        i => i.matchHostName(options) && i.options.allowUnmocked
      )

      if (allowUnmocked && req instanceof ClientRequest) {
        const newReq =
          options.proto === 'https'
            ? originalHttpsRequest(options)
            : originalHttpRequest(options)

        propagate(newReq, req)
        // We send the raw buffer as we received it, not as we interpreted it.
        newReq.end(requestBodyBuffer)
      } else {
        const err = new Error(
          `Nock: No match for request ${common.stringifyRequest(
            options,
            requestBodyString
          )}`
        )
        err.statusCode = err.status = 404
        this.emitError(err)
      }
    }
  }
}

/**
 * Play back an intercepto using the given request and mock response.
 */
class InterceptorPlayback {
  constructor({
    req,
    options,
    requestBodyString,
    isBinaryRequestBodyBuffer,
    response,
    interceptor,
  }) {
    this.req = req
    this.options = options
    this.requestBodyString = requestBodyString
    this.response = response
    this.interceptor = interceptor
    this.isBinaryRequestBodyBuffer = isBinaryRequestBodyBuffer
  }

  emitError(error) {
    emitError(this.req, error)
  }

  start() {
    const {
      req,
      response,
      interceptor,
      options,
      requestBodyString,
      isBinaryRequestBodyBuffer,
    } = this

    // We again set request headers, now for our matched interceptor.
    setRequestHeaders(req, options, interceptor)
    interceptor.req = req
    req.headers = req.getHeaders()

    interceptor.scope.emit('request', req, interceptor, requestBodyString)

    if (typeof interceptor.errorMessage !== 'undefined') {
      interceptor.markConsumed()

      let error
      if (_.isObject(interceptor.errorMessage)) {
        error = interceptor.errorMessage
      } else {
        error = new Error(interceptor.errorMessage)
      }
      timers.setTimeout(
        () => this.emitError(error),
        interceptor.getTotalDelay()
      )
      return
    }

    // This will be null if we have a fullReplyFunction,
    // in that case status code will be set in `parseFullReplyResult`
    response.statusCode = interceptor.statusCode

    // Clone headers/rawHeaders to not override them when evaluating later
    response.rawHeaders = [...interceptor.rawHeaders]
    debug('response.rawHeaders:', response.rawHeaders)

    if (interceptor.replyFunction) {
      const parsedRequestBody = parseJSONRequestBody(req, requestBodyString)

      let fn = interceptor.replyFunction
      if (fn.length === 3) {
        // Handle the case of an async reply function, the third parameter being the callback.
        fn = util.promisify(fn)
      }

      // At this point `fn` is either a synchronous function or a promise-returning function;
      // wrapping in `Promise.resolve` makes it into a promise either way.
      Promise.resolve(fn.call(interceptor, options.path, parsedRequestBody))
        .then(responseBody => this.continueWithResponseBody({ responseBody }))
        .catch(err => this.emitError(err))
      return
    }

    if (interceptor.fullReplyFunction) {
      const parsedRequestBody = parseJSONRequestBody(req, requestBodyString)

      let fn = interceptor.fullReplyFunction
      if (fn.length === 3) {
        fn = util.promisify(fn)
      }

      Promise.resolve(fn.call(interceptor, options.path, parsedRequestBody))
        .then(fullReplyResult =>
          this.continueWithFullResponse({ fullReplyResult })
        )
        .catch(err => this.emitError(err))
      return
    }

    if (
      common.isContentEncoded(interceptor.headers) &&
      !common.isStream(interceptor.body)
    ) {
      //  If the content is encoded we know that the response body *must* be an array
      //  of response buffers which should be mocked one by one.
      //  (otherwise decompressions after the first one fails as unzip expects to receive
      //  buffer by buffer and not one single merged buffer)

      if (interceptor.delayInMs) {
        this.emitError(
          new Error(
            'Response delay of the body is currently not supported with content-encoded responses.'
          )
        )
        return
      }

      const bufferData = Array.isArray(interceptor.body)
        ? interceptor.body
        : [interceptor.body]
      const responseBuffers = bufferData.map(data => Buffer.from(data, 'hex'))
      this.continueWithResponseBody({ responseBuffers })
      return
    }

    // If we get to this point, the body is either a string or an object that
    // will eventually be JSON stringified.
    let responseBody = interceptor.body

    // If the request was binary then we assume that the response will be binary
    // as well. In that case we send the response as a Buffer object as that's
    // what the client will expect.
    if (isBinaryRequestBodyBuffer && typeof responseBody === 'string') {
      // Try to create the buffer from the interceptor's body response as hex.
      responseBody = Buffer.from(responseBody, 'hex')

      // Creating buffers does not necessarily throw errors; check for difference in size.
      if (
        !responseBody ||
        (interceptor.body.length > 0 && responseBody.length === 0)
      ) {
        // We fallback on constructing buffer from utf8 representation of the body.
        responseBody = Buffer.from(interceptor.body, 'utf8')
      }
    }

    return this.continueWithResponseBody({ responseBody })
  }

  continueWithFullResponse({ fullReplyResult }) {
    const { response } = this

    let responseBody
    try {
      responseBody = parseFullReplyResult(response, fullReplyResult)
    } catch (innerErr) {
      this.emitError(innerErr)
      return
    }

    this.continueWithResponseBody({ responseBody })
  }

  continueWithResponseBody({ responseBuffers, responseBody }) {
    const { req, response, interceptor } = this

    //  Transform the response body if it exists (it may not exist
    //  if we have `responseBuffers` instead)
    if (responseBody !== undefined) {
      debug('transform the response body')

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
          // https://nodejs.org/dist/latest-v10.x/docs/api/http.html#http_message_complete
          response.complete = true
        })
        responseBody.on('error', function(err) {
          response.emit('error', err)
        })
      } else if (!Buffer.isBuffer(responseBody)) {
        if (typeof responseBody === 'string') {
          responseBody = Buffer.from(responseBody)
        } else {
          responseBody = JSON.stringify(responseBody)
          response.rawHeaders.push('Content-Type', 'application/json')
        }
      }
      // Why are strings converted to a Buffer, but JSON data is left as a string?
      // Related to https://github.com/nock/nock/issues/1542 ?
    }

    interceptor.markConsumed()

    if (req.aborted) {
      return
    }

    response.rawHeaders.push(
      ...selectDefaultHeaders(
        response.rawHeaders,
        interceptor.scope._defaultReplyHeaders
      )
    )

    // Evaluate functional headers.
    common.forEachHeader(response.rawHeaders, (value, fieldName, i) => {
      if (typeof value === 'function') {
        response.rawHeaders[i + 1] = value(req, response, responseBody)
      }
    })

    response.headers = common.headersArrayToObject(response.rawHeaders)

    process.nextTick(() =>
      this.respondUsingInterceptor({
        interceptor,
        responseBody,
        responseBuffers,
      })
    )
  }

  respondUsingInterceptor({ responseBody, responseBuffers }) {
    const { req, response, interceptor } = this

    if (req.aborted) {
      return
    }

    function respond() {
      if (req.aborted) {
        return
      }

      debug('emitting response')
      req.emit('response', response)

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
            // https://nodejs.org/dist/latest-v10.x/docs/api/http.html#http_message_complete
            response.complete = true
            interceptor.scope.emit('replied', req, interceptor)
          }
        })
      }
    }

    if (interceptor.socketDelayInMs && interceptor.socketDelayInMs > 0) {
      req.socket.applyDelay(interceptor.socketDelayInMs)
    }

    if (
      interceptor.delayConnectionInMs &&
      interceptor.delayConnectionInMs > 0
    ) {
      req.socket.applyDelay(interceptor.delayConnectionInMs)
      setTimeout(respond, interceptor.delayConnectionInMs)
    } else {
      respond()
    }
  }
}

function parseJSONRequestBody(req, requestBody) {
  if (!requestBody || !common.isJSONContent(req.headers)) {
    return requestBody
  }

  if (common.contentEncoding(req.headers, 'gzip')) {
    requestBody = String(zlib.gunzipSync(Buffer.from(requestBody, 'hex')))
  } else if (common.contentEncoding(req.headers, 'deflate')) {
    requestBody = String(zlib.inflateSync(Buffer.from(requestBody, 'hex')))
  }

  return JSON.parse(requestBody)
}

function parseFullReplyResult(response, fullReplyResult) {
  debug('full response from callback result: %j', fullReplyResult)

  if (!Array.isArray(fullReplyResult)) {
    throw Error('A single function provided to .reply MUST return an array')
  }

  if (fullReplyResult.length > 3) {
    throw Error(
      'The array returned from the .reply callback contains too many values'
    )
  }

  const [status, body = '', headers] = fullReplyResult

  if (!Number.isInteger(status)) {
    throw new Error(`Invalid ${typeof status} value for status code`)
  }

  response.statusCode = status
  response.rawHeaders.push(...common.headersInputToRawArray(headers))
  debug('response.rawHeaders after reply: %j', response.rawHeaders)

  return body
}

/**
 * Determine which of the default headers should be added to the response.
 *
 * Don't include any defaults whose case-insensitive keys are already on the response.
 */
function selectDefaultHeaders(existingHeaders, defaultHeaders) {
  if (!defaultHeaders.length) {
    return [] // return early if we don't need to bother
  }

  const definedHeaders = new Set()
  const result = []

  common.forEachHeader(existingHeaders, (_, fieldName) => {
    definedHeaders.add(fieldName.toLowerCase())
  })
  common.forEachHeader(defaultHeaders, (value, fieldName) => {
    if (!definedHeaders.has(fieldName.toLowerCase())) {
      result.push(fieldName, value)
    }
  })

  return result
}

module.exports = { InterceptedRequestBroker }
