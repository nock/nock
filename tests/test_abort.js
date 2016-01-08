'use strict';

var nock    = require('../.');
var http    = require('http');
var test    = require('tap').test;

function assertEvents(assert, done) {
  var gotAbort = false
  var req = http.get('http://localhost:16829/status')
    .on('abort', function () {
      // Should trigger first
      gotAbort = true
    })
    .on('error', function (err) {
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

test("abort is emitted after delay time", function(t) {
  nock('http://test.example.com')
        .get('/status')
        .delayConnection(500)
        .reply(204);

  var tstart = Date.now();
  var req = http.get('http://test.example.com/status')
  // Don't bother with the response
  .once('abort', function() {
    var actual = Date.now() - tstart;
    t.ok(actual < 250, 'abort took only ' + actual + ' ms');
    t.end();
  })
  .once('error', function(err) {
    // don't care
  });

  setTimeout(function() {
    req.abort();
  }, 10);
});
