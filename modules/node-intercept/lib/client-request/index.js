// @ts-check

const { inherits } = require('util')
const http = require('http')
const stream = require('stream')

const debug = require('debug')('nock.request_overrider')
const propagate = require('propagate')

const { isRequestDestroyed } = require('../utils')
const Socket = require('../socket')
const normalizeNodeRequestArguments = require('../normalize-request-arguments')

const MOCK_RESPONSE = {
  statusCode: 200,
  rawHeaders: [],
  headers: {},
  body: 'Hello, world!',
}

// @ts-expect-error - socket is incompatible with Node's Socket type
class NockInterceptedClientRequest extends http.OutgoingMessage {
  constructor(...args) {
    super()

    const { options, callback } = normalizeNodeRequestArguments(...args)

    // TODO: handle empty {} options

    /** @type {import("./types").State} */
    const state = {
      options,
      requestBodyBuffers: [],
      playbackStarted: false,

      // For parity with Node, it's important the socket event is emitted before we begin playback.
      // This flag is set when playback is triggered if we haven't yet gotten the
      // socket event to indicate that playback should start as soon as it comes in.
      readyToStartPlaybackOnSocketEvent: false,
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
    this.flushHeaders = () => handleFlushHeaders(state, this)

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

    if (callback) {
      this.once('response', callback)
    }
  }
}
inherits(NockInterceptedClientRequest, http.ClientRequest)

function connectSocket(request, state) {
  if (isRequestDestroyed(request)) {
    return
  }

  propagate(['error', 'timeout'], request.socket, request)
  request.socket.on('close', () => handleSocketClose(request))

  request.socket.connecting = false
  request.emit('socket', request.socket)

  // https://nodejs.org/api/net.html#net_event_connect
  request.socket.emit('connect')

  // https://nodejs.org/api/tls.html#tls_event_secureconnect
  if (request.socket.authorized) {
    request.socket.emit('secureConnect')
  }

  if (state.readyToStartPlaybackOnSocketEvent) {
    maybeStartPlayback(request, state)
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
    return true
  }

  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer, encoding)
  }
  state.requestBodyBuffers.push(buffer)

  // can't use instanceof Function because some test runners
  // run tests in vm.runInNewContext where Function is not same
  // as that in the current context
  // https://github.com/nock/nock/pull/1754#issuecomment-571531407
  if (typeof callback === 'function') {
    callback()
  }

  setImmediate(function () {
    request.emit('drain')
  })

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
  maybeStartPlayback(request, state)

  return request
}

function handleFlushHeaders(request, state) {
  debug('request flushHeaders')
  maybeStartPlayback(request, state)
}

function handleSocketClose(request) {
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

function maybeStartPlayback(request, state) {
  // In order to get the events in the right order we need to delay playback
  // if we get here before the `socket` event is emitted.
  if (request.socket.connecting) {
    state.readyToStartPlaybackOnSocketEvent = true
    return
  }

  if (!isRequestDestroyed(request) && !state.playbackStarted) {
    startPlayback(request, state)
  }
}

function startPlayback(request, state) {
  debug('ending')

  state.playbackStarted = true

  const options = state.options

  Object.assign(options, {
    // Re-update `options` with the current value of `request.path` because badly
    // behaving agents like superagent like to change `request.path` mid-flight.
    path: request.path,
    // Similarly, node-http-proxy will modify headers in flight, so we have
    // to put the headers back into options.
    // https://github.com/nock/nock/pull/1484
    headers: request.getHeaders(),
    // Fixes https://github.com/nock/nock/issues/976
    protocol: `${options.proto}:`,
  })

  // set host header
  let hostHeader = options.host
  if (options.port === 80 || options.port === 443) {
    hostHeader = hostHeader.split(':')[0]
  }
  request.setHeader('host', hostHeader)

  // wait to emit the finish event until we know for sure that the request will be intercepted,
  // Otherwise an unmocked request might emit finish twice.
  request.emit('finish')

  // Calling `start` immediately could take the request all the way to the connection delay
  // during a single microtask execution. This setImmediate stalls the playback to ensure the
  // correct events are emitted first ('socket', 'finish') and any aborts in the in the queue or
  // called during a 'finish' listener can be called.
  setImmediate(() => {
    if (isRequestDestroyed(request)) return

    start(request, state)
  })
}

/**
 *
 * @param {http.ClientRequest} request
 * @param {import("./types").State} state
 * @returns
 */
function start(request, state) {
  const response = new http.IncomingMessage(request.socket)

  response.statusCode = MOCK_RESPONSE.statusCode
  response.rawHeaders = MOCK_RESPONSE.rawHeaders
  response.headers = MOCK_RESPONSE.headers
  let responseBody = MOCK_RESPONSE.body

  const bodyAsStream = new ReadableBuffers([Buffer.from(responseBody)])
  bodyAsStream.pause()

  // IncomingMessage extends Readable so we can't simply pipe.
  bodyAsStream.on('data', function (chunk) {
    response.push(chunk)
  })
  bodyAsStream.on('end', function () {
    // https://nodejs.org/api/http.html#http_message_complete
    response.complete = true
    response.push(null)
  })
  bodyAsStream.on('error', function (err) {
    response.emit('error', err)
  })

  if (isRequestDestroyed(request)) {
    return
  }

  // Even though we've had the response object for a while at this point,
  // we only attach it to the request immediately before the `response`
  // event because, as in Node, it alters the error handling around aborts.
  // @ts-expect-error - no idea why `.req` is not typed on ClientRequest
  request.res = response
  // @ts-expect-error - no idea why `.res` is not typed on IncomingMessage
  response.req = request

  request.emit('response', response)

  bodyAsStream.resume()
}

// Presents a list of Buffers as a Readable
class ReadableBuffers extends stream.Readable {
  constructor(buffers, opts = {}) {
    super(opts)

    this.buffers = buffers
  }

  _read(size) {
    while (this.buffers.length) {
      if (!this.push(this.buffers.shift())) {
        return
      }
    }
    this.push(null)
  }
}

module.exports = NockInterceptedClientRequest
