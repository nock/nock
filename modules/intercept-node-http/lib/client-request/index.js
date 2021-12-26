// @ts-check

const { inherits } = require('util')
const http = require('http')
const https = require('https')

const debug = require('debug')('nock.request_overrider')
const propagate = require('propagate')

// TODO: add API to handle pending requests
const { setImmediate } = require('../../../../lib/common')
const { isRequestDestroyed } = require('../utils')
const Socket = require('../socket')
const normalizeNodeRequestArguments = require('../normalize-request-arguments')

function createNockInterceptedClientRequest(onIntercept) {
  const OriginalClientRequest = http.ClientRequest

  // @ts-expect-error - socket is incompatible with Node's Socket type
  class NockInterceptedClientRequest extends http.OutgoingMessage {
    constructor(...args) {
      super()

      const { options, callback } = normalizeNodeRequestArguments(...args)

      // TODO: handle empty {} options

      /** @type {import("./types").State} */
      const state = {
        onIntercept,
        intercepted: undefined,
        options,
        onResponseCallback: callback,
        requestBodyChunks: [],
        interceptStarted: false,

        // For parity with Node, it's important the socket event is emitted before we begin playback.
        // This flag is set when playback is triggered if we haven't yet gotten the
        // socket event to indicate that playback should start as soon as it comes in.
        readyToInterceptOnSocketEvent: false,
      }

      // set headers
      for (const [name, val] of Object.entries(options.headers)) {
        this.setHeader(name.toLowerCase(), val)
      }

      if (options.auth && !options.headers.authorization) {
        this.setHeader(
          // We use lower-case header field names throughout Nock.
          'authorization',
          `Basic ${Buffer.from(options.auth).toString('base64')}`
        )
      }

      // set method & path
      this.method = options.method
      this.path = options.path

      // set socket
      this.socket = new Socket({
        // We may be changing the options object and we don't want those changes
        // affecting the user so we use a clone of the object.
        ...options,
      })

      // .connection is a deprecated alias for .socket
      this.connection = this.socket

      // override public API methods
      this.write = (...args) => handleWrite(this, state, ...args)
      this.end = (...args) => handleEnd(this, state, ...args)
      this.flushHeaders = () => handleFlushHeaders(this, state)

      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expect
      if (options.headers.expect === '100-continue') {
        setImmediate(() => {
          debug('continue')
          this.emit('continue')
        })
      }

      // support setting `timeout` using request `options`
      // https://nodejs.org/docs/latest-v12.x/api/http.html#http_http_request_url_options_callback
      if (options.timeout) {
        this.socket.setTimeout(options.timeout)
      }

      // Emit a fake socket event on the next tick to mimic what would happen on a real request.
      // Some clients listen for a 'socket' event to be emitted before calling end(),
      // which causes Nock to hang.
      process.nextTick(() => connectSocket(this, state))

      if (state.onResponseCallback) {
        this.once('response', state.onResponseCallback)
      }

      /**
       * Create an instance for the original `http.ClientRequest` and proxy
       * all events from the real request to the mocked one. Then send the
       * new request
       */
      this.nockSendRealRequest = function nockSendRealRequest() {
        state.intercepted = false
        const newOptions = {
          ...state.options,
          _defaultAgent:
            state.options.protocol === 'http:'
              ? http.globalAgent
              : https.globalAgent,
        }

        this.socket.removeAllListeners()

        // do not call response callback twice
        if (state.onResponseCallback) {
          this.removeListener('response', state.onResponseCallback)
        }

        const newRequest = new OriginalClientRequest(
          newOptions,
          state.onResponseCallback
        )

        propagate(newRequest, this)

        newRequest.on('error', () => {})

        // write request body on next tick
        // to enable recording
        process.nextTick(() => {
          for (const buffer of state.requestBodyChunks) {
            newRequest.write(buffer)
          }

          newRequest.end()
        })

        // TODO: make sure that this.emit('finish') is not called when
        // the real requests is sent out, and that it's called when
        // the response is mocked

        return newRequest
      }

      /**
       * Expose method to retrieve request body as a buffer for matching purposes
       *
       * @returns {Buffer[]}
       */
      this.nockGetRequestBodyChunks = function nockGetRequestBodyChunks() {
        return state.requestBodyChunks
      }
    }
  }

  inherits(NockInterceptedClientRequest, http.ClientRequest)

  return NockInterceptedClientRequest
}

function connectSocket(request, state) {
  if (isRequestDestroyed(request)) {
    return
  }

  propagate(['error', 'timeout'], request.socket, request)
  request.socket.on('close', () => handleSocketClose(request, state))

  request.socket.connecting = false
  request.emit('socket', request.socket)

  // https://nodejs.org/api/net.html#net_event_connect
  request.socket.emit('connect')

  // https://nodejs.org/api/tls.html#tls_event_secureconnect
  if (request.socket.authorized) {
    request.socket.emit('secureConnect')
  }

  if (state.readyToInterceptOnSocketEvent) {
    maybePrepareForIntercept(request, state)
  }
}

// from docs: When write function is called with empty string or buffer, it does nothing and waits for more input.
// However, actually implementation checks the state of finished and aborted before checking if the first arg is empty.
function handleWrite(request, state, buffer, encoding, callback) {
  debug('request write')

  if (request.finished) {
    const err = Object.assign(new Error('write after end'), {
      code: 'ERR_STREAM_WRITE_AFTER_END',
    })

    process.nextTick(() => request.emit('error', err))

    // It seems odd to return `true` here, not sure why you'd want to have
    // the stream potentially written to more, but it's what Node does.
    // https://github.com/nodejs/node/blob/a9270dcbeba4316b1e179b77ecb6c46af5aa8c20/lib/_http_outgoing.js#L662-L665
    return true
  }

  if (request.socket && request.socket.destroyed) {
    return false
  }

  if (!buffer) {
    // throw helpful error when writing without a chunk
    // this was previously inmplemented in nock's `lib/recorder.js`
    if (arguments.length === 2) {
      throw new Error('Data was undefined.')
    }

    return true
  }

  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer, encoding)
  }
  state.requestBodyChunks.push(buffer)

  // can't use instanceof Function because some test runners
  // run tests in vm.runInNewContext where Function is not same
  // as that in the current context
  // https://github.com/nock/nock/pull/1754#issuecomment-571531407
  if (typeof callback === 'function') {
    callback()
  }

  setImmediate(() => request.emit('drain'))

  return false
}

function handleEnd(request, state, chunk, encoding, callback) {
  debug('request end')

  // handle the different overloaded arg signatures
  if (typeof chunk === 'function') {
    callback = chunk
    chunk = null
  } else if (typeof encoding === 'function') {
    callback = encoding
    encoding = null
  }

  if (typeof callback === 'function') {
    request.once('finish', callback)
  }

  if (chunk) {
    request.write(chunk, encoding)
  }
  request.finished = true
  maybePrepareForIntercept(request, state)

  return request
}

function handleFlushHeaders(request, state) {
  debug('request flushHeaders')
  maybePrepareForIntercept(request, state)
}

function handleSocketClose(request, state) {
  debug('socket close')

  if (!request.res && !request.socket._hadError) {
    // If we don't have a response then we know that the socket
    // ended prematurely and we need to emit an error on the request.
    request.socket._hadError = true
    request.emit(
      'error',
      Object.assign(new Error('socket hang up'), {
        code: 'ECONNRESET',
      })
    )
  }
  request.emit('close')
}

function maybePrepareForIntercept(request, state) {
  // In order to get the events in the right order we need to delay the intercept
  // if we get here before the `socket` event is emitted.
  if (request.socket.connecting) {
    state.readyToInterceptOnSocketEvent = true
    return
  }

  if (!isRequestDestroyed(request) && !state.interceptStarted) {
    prepareForIntercept(request, state)
  }
}

function prepareForIntercept(request, state) {
  debug('ending')

  state.intercepted = true
  state.interceptStarted = true

  const options = {
    ...state.options,

    // Re-update `options` with the current value of `request.path` because badly
    // behaving agents like superagent like to change `request.path` mid-flight.
    path: request.path,
    // Similarly, node-http-proxy will modify headers in flight, so we have
    // to put the headers back into options.
    // https://github.com/nock/nock/pull/1484
    headers: request.getHeaders(),
  }

  // set host header
  let hostHeader = options.host || options.hostname || 'localhost'
  if (options.port === 80 || options.port === 443) {
    hostHeader = hostHeader.split(':')[0]
  }

  request.setHeader('host', hostHeader)

  // Calling `start` immediately could take the request all the way to the connection delay
  // during a single microtask execution. This setImmediate stalls the playback to ensure the
  // correct events are emitted first ('socket', 'finish') and any aborts in the in the queue or
  // called during a 'finish' listener can be called.
  setImmediate(() => {
    if (isRequestDestroyed(request)) return

    state.onIntercept(options, request)

    if (state.intercepted !== false) {
      // wait to emit the finish event until we know for sure that the request will be intercepted,
      // Otherwise an unmocked request might emit finish twice.
      request.emit('finish')
    }
  })
}

module.exports = createNockInterceptedClientRequest
