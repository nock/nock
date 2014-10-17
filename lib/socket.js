'use strict';

var EventEmitter = require('events').EventEmitter;

module.exports = Socket;

function Socket() {
  var socket = new EventEmitter();

  socket.writable = true;

  socket.setNoDelay = noop;
  socket.setTimeout = noop;
  socket.setKeepAlive = noop;
  socket.destroy = noop;

  socket.getPeerCertificate = getPeerCertificate;

  return socket;
}

function noop() {}

function getPeerCertificate() {
  return new Buffer((Math.random() * 10000 + Date.now()).toString()).toString('base64');
}