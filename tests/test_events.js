'use strict';

var nock    = require('../.');
var http    = require('http');
var test    = require('tap').test;

test("abort is emitted before delay time", function(t) {
  var scope = nock('http://eventland')
        .get('/please')
        .reply(200);

  scope.on('request', function(req, interceptor) {
    t.equal(req.path, '/please');
    t.equal(interceptor.interceptionCounter, 0);
    scope.on('replied', function(req, interceptor) {
      t.equal(req.path, '/please');
      t.equal(interceptor.interceptionCounter, 1);
      t.end();
    });
  });

  var req = http.get('http://eventland/please');
});
