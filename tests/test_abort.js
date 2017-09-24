'use strict';

var nock    = require('../.');
var http    = require('http');
var test    = require('tap').test;

function assertEvents(t, cb) {
  var gotAbort = false
  var req = http.get('http://localhost:16829/status')
    .once('abort', function () {
      // Should trigger first
      gotAbort = true
    })
    .once('error', function (err) {
      // Should trigger last
      t.equal(err.code, 'ECONNRESET')
      t.ok(gotAbort, 'didn\'t get abort event');
      t.end();
      if(cb) {
        cb();
      }
    });

  process.nextTick(function(){
    req.abort();
  });
}

test('[actual] req.abort() should cause "abort" and "error" to be emitted', function (t) {
  nock('http://localhost:16829')
    .get('/status')
    .delayConnection(500)
    .reply(204);

  assertEvents(t);
});

test("abort is emitted before delay time", function(t) {
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

test("Aborting an aborted request should not emit an error", function(t) {
  nock('http://test.example.com')
    .get('/status')
    .reply(200);

  var errorCount = 0
  var req = http.get('http://test.example.com/status')
    .on('error', function(err) {
      errorCount++;
      if (errorCount < 3) {
        // Abort 3 times at max, otherwise this would be an endless loop,
        // if #882 pops up again.
        req.abort();
      }
    });
  req.abort();

  // Give nock some time to fail
  setTimeout(function() {
    t.equal(errorCount, 1,"Only one error should be sent.");
    t.end();
  },10);
});
