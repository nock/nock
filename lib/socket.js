'use strict'

const { EventEmitter } = require('events')
const debug = require('debug')('nock.socket')
const util = require('util')

module.exports = Socket

function Socket(options) {
  EventEmitter.apply(this)

  if (options.proto === 'https') {
    // https://github.com/nock/nock/issues/158
    this.authorized = true
  }

  this.writable = true
  this.readable = true
  this.destroyed = false
  this.connecting = false

  this.setNoDelay = noop
  this.setKeepAlive = noop
  this.resume = noop
  this.unref = noop

  // totalDelay that has already been applied to the current
  // request/connection, timeout error will be generated if
  // it is timed-out.
  this.totalDelayMs = 0
  // Maximum allowed delay. Null means unlimited.
  this.timeoutMs = null
}
util.inherits(Socket, EventEmitter)

Socket.prototype.setTimeout = function setTimeout(timeoutMs, fn) {
  this.timeoutMs = timeoutMs
  // Before Node v10, setting a timeout on a request would proxy the callback to this method, however,
  // v10+ sets the callback on the request and relies on the socket -> request propagation. Therefore,
  // when run code coverage is run on Node v8 the else path is never executed.
  /* istanbul ignore else */
  if (fn) {
    this.once('timeout', fn)
  }
}

Socket.prototype.applyDelay = function applyDelay(delayMs) {
  this.totalDelayMs += delayMs

  if (this.timeoutMs && this.totalDelayMs > this.timeoutMs) {
    debug('socket timeout')
    this.emit('timeout')
  }
}

Socket.prototype.getPeerCertificate = function getPeerCertificate() {
  return Buffer.from((Math.random() * 10000 + Date.now()).toString()).toString(
    'base64'
  )
}

Socket.prototype.destroy = function destroy() {
  this.destroyed = true
  this.readable = this.writable = false
}

function noop() {}
