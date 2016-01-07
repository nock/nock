'use strict';

var nock    = require('../.');
var http    = require('http');
var test    = require('tap').test;

test("double activation throws exception", function(t) {
  nock('http://test.example.com')
        .get('/status')
        .delayConnection(500)
        .reply(204)

  var tstart = Date.now()
  var req = http.get('http://test.example.com/status')
  // Don't bother with the response
  .once('abort', function () {
    var actual = Date.now() - tstart;
    t.ok(actual < 250, 'abort took only ' + actual + ' ms');
    t.end();
  });
  setTimeout(function(){ req.abort() }, 10);
});
