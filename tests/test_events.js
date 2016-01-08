'use strict';

var nock    = require('../.');
var http    = require('http');
var test    = require('tap').test;

test('emits request and replied events', function(t) {
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

test('emits no match when no match and no mock', function(t) {
  nock.emitter.on('no match', function(req) {
    t.end();
  });

  var req = http.get('http://doesnotexistandneverexistedbefore/abc');
  req.once('error', ignore);
});

test('emits no match when no match and mocked', function(t) {

  nock('http://itmayormaynotexistidontknowreally')
    .get('/')
    .reply('howdy');


  nock.emitter.on('no match', function(req) {
    t.equal(req.path, '/definitelymaybe');
    t.end();
  });

  http.get('http://itmayormaynotexistidontknowreally/definitelymaybe')
    .once('error', ignore);
});

function ignore() {}
