module.exports = NockInterceptedClientRequest

const http = require('http')

const debug = require('debug')('nock.request_overrider')
const propagate = require('propagate')

const { isRequestDestroyed, isUtf8Representable } = require('./utils')
const Socket = require('./socket')
const normalizeNodeRequestArguments = require('./normalize-request-arguments')

function socketOnClose(req) {
  debug('socket close')

  if (!req.res && !req.socket._hadError) {
    // If we don't have a response then we know that the socket
    // ended prematurely and we need to emit an error on the request.
    req.socket._hadError = true
    req.emit(
      'error',
      Object.assign(new Error('socket hang up'), {
        code: 'ECONNRESET',
      })
    )
  }
  req.emit('close')
}

class NockInterceptedClientRequest extends http.ClientRequest {
  constructor(...args) {
    const { options, callback } = normalizeNodeRequestArguments(...args)

    // TODO: handle Object.keys(options).length === 0

    http.OutgoingMessage.call(this)

    prepare(this, options, socket)

    this._nock = {}
    this._nock.options = options
    this._nock.response = new http.IncomingMessage(socket)
    this._nock.requestBodyBuffers = []
    this._nock.playbackStarted = false

    // For parity with Node, it's important the socket event is emitted before we begin playback.
    // This flag is set when playback is triggered if we haven't yet gotten the
    // socket event to indicate that playback should start as soon as it comes in.
    this._nock.readyToStartPlaybackOnSocketEvent = false

    // Emit a fake socket event on the next tick to mimic what would happen on a real request.
    // Some clients listen for a 'socket' event to be emitted before calling end(),
    // which causes Nock to hang.
    process.nextTick(() => this.connectSocket())

    if (callback) {
      this.once('response', callback)
    }
  }

  connectSocket() {
    if (isRequestDestroyed(this)) {
      return
    }

    propagate(['error', 'timeout'], this.socket, this)
    this.socket.on('close', () => socketOnClose(this))

    this.socket.connecting = false
    this.emit('socket', this.socket)

    // https://nodejs.org/api/net.html#net_event_connect
    this.socket.emit('connect')

    // https://nodejs.org/api/tls.html#tls_event_secureconnect
    if (this.socket.authorized) {
      this.socket.emit('secureConnect')
    }

    if (this._nock.readyToStartPlaybackOnSocketEvent) {
      this.maybeStartPlayback()
    }
  }

  // from docs: When write function is called with empty string or buffer, it does nothing and waits for more input.
  // However, actually implementation checks the state of finished and aborted before checking if the first arg is empty.
  handleWrite(socket, buffer, encoding, callback) {
    debug('request write')

    if (this.finished) {
      const err = new Error('write after end')
      err.code = 'ERR_STREAM_WRITE_AFTER_END'
      process.nextTick(() => this.emit('error', err))

      // It seems odd to return `true` here, not sure why you'd want to have
      // the stream potentially written to more, but it's what Node does.
      // https://github.com/nodejs/node/blob/a9270dcbeba4316b1e179b77ecb6c46af5aa8c20/lib/_http_outgoing.js#L662-L665
      return true
    }

    if (socket && socket.destroyed) {
      return false
    }

    if (!buffer) {
      return true
    }

    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer, encoding)
    }
    this._nock.requestBodyBuffers.push(buffer)

    // can't use instanceof Function because some test runners
    // run tests in vm.runInNewContext where Function is not same
    // as that in the current context
    // https://github.com/nock/nock/pull/1754#issuecomment-571531407
    if (typeof callback === 'function') {
      callback()
    }

    setImmediate(function () {
      this.emit('drain')
    })

    return false
  }

  handleEnd(chunk, encoding, callback) {
    debug('request end')
    const { req } = this

    // handle the different overloaded arg signatures
    if (typeof chunk === 'function') {
      callback = chunk
      chunk = null
    } else if (typeof encoding === 'function') {
      callback = encoding
      encoding = null
    }

    if (typeof callback === 'function') {
      req.once('finish', callback)
    }

    if (chunk) {
      req.write(chunk, encoding)
    }
    req.finished = true
    this.maybeStartPlayback()

    return req
  }

  handleFlushHeaders() {
    debug('request flushHeaders')
    this.maybeStartPlayback()
  }

  maybeStartPlayback() {
    // In order to get the events in the right order we need to delay playback
    // if we get here before the `socket` event is emitted.
    if (this.socket.connecting) {
      this._nock.readyToStartPlaybackOnSocketEvent = true
      return
    }

    if (!isRequestDestroyed(this) && !this._nock.playbackStarted) {
      this.startPlayback()
    }
  }

  startPlayback() {
    debug('ending')
    this._nock.playbackStarted = true

    const options = this._nock.options

    Object.assign(options, {
      // Re-update `options` with the current value of `req.path` because badly
      // behaving agents like superagent like to change `req.path` mid-flight.
      path: req.path,
      // Similarly, node-http-proxy will modify headers in flight, so we have
      // to put the headers back into options.
      // https://github.com/nock/nock/pull/1484
      headers: req.getHeaders(),
      // Fixes https://github.com/nock/nock/issues/976
      protocol: `${options.proto}:`,
    })

    // set host header
    let hostHeader = options.host
    if (options.port === 80 || options.port === 443) {
      hostHeader = hostHeader.split(':')[0]
    }
    req.setHeader(HOST_HEADER, hostHeader)

    // wait to emit the finish event until we know for sure an Interceptor is going to playback.
    // otherwise an unmocked request might emit finish twice.
    req.emit('finish')

    // callback(req, res)
  }
}

function prepare(req, options) {
  // set headers
  for (const [name, val] of Object.entries(options.headers)) {
    req.setHeader(name.toLowerCase(), val)
  }

  if (options.auth && !options.headers.authorization) {
    req.setHeader(
      // We use lower-case header field names throughout Nock.
      'authorization',
      `Basic ${Buffer.from(options.auth).toString('base64')}`
    )
  }

  // set method & path
  req.method = options.method
  req.path = options.path

  // set socket
  this.socket = new Socket({
    // We may be changing the options object and we don't want those changes
    // affecting the user so we use a clone of the object.
    ...options,
  })

  // .connection is a deprecated alias for .socket
  this.connection = this.socket

  // override public API methods
  req.write = (...args) => req.handleWrite(options, ...args)
  req.end = (...args) => req.handleEnd(options, ...args)
  req.flushHeaders = () => req.handleFlushHeaders(options)

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Expect
  if (options.headers.expect === '100-continue') {
    setImmediate(() => {
      debug('continue')
      req.emit('continue')
    })
  }

  // support setting `timeout` using request `options`
  // https://nodejs.org/docs/latest-v12.x/api/http.html#http_http_request_url_options_callback
  if (options.timeout) {
    socket.setTimeout(options.timeout)
  }
}
