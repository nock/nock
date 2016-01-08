'use strict';

var nock    = require('../.');
var http    = require('http');
var test    = require('tap').test;

function assertEvents(assert, done) {
  var gotAbort = false
  var req = http.get('http://localhost:16829/status')
    .on('abort', function () {
      console.log('got abort');
      // Should trigger first
      gotAbort = true
    })
    .on('error', function (err) {
      console.log('got error', err.message);
      // Should trigger last
      assert.equal(err.code, 'ECONNRESET')
      if (gotAbort) {
        done();
      }
    });

  process.nextTick(function(){
    req.abort();
  });
}

test('[expected] req.abort() should cause "abort" and "error" to be emitted', function (t) {
  var server = http.createServer()
    .on('request', function (req, res) {
      setTimeout(function () {
        res.statusCode = 204;
        res.end();
      }, 500);
    })
    .listen(16829);

  assertEvents(t, function () {
    server.close(t.end.bind(t));
  });
});

test('[actual] req.abort() should cause "abort" and "error" to be emitted', function (t) {
  nock('http://localhost:16829')
    .get('/status')
    .delayConnection(500)
    .reply(204);

  assertEvents(t, function(){
    t.end();
  });
});
