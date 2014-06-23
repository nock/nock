var EventEmitter = require('events').EventEmitter;

module.exports = Socket;

function Socket() {
  var socket = new EventEmitter();

  socket.writable = true;

  socket.setNoDelay = noop;
  socket.setTimeout = noop;

  return socket;
}

function noop() {}