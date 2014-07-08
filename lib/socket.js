var EventEmitter = require('events').EventEmitter;

module.exports = Socket;

function Socket() {
  var socket = new EventEmitter();

  socket.writable = true;

  socket.setNoDelay = noop;
  socket.setTimeout = noop;
  socket.setKeepAlive = noop;
  socket.once = function(method, cb) {
    cb();
  };

  return socket;
}

function noop() {}