'use strict';

var nock = require('../.');
var http = require('http');
var test = require('tap').test;

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


  var assertion = function(req) {
    t.equal(req.path, '/definitelymaybe');
    nock.emitter.removeAllListeners('no match');
    t.end();
  }
  var result = nock.emitter.on('no match', assertion);

  http.get('http://itmayormaynotexistidontknowreally/definitelymaybe')
    .once('error', ignore);
});

test('emits no match when netConnect is disabled', function(t) {
  nock.disableNetConnect();
  nock.emitter.on('no match', function(req) {
    t.equal(req.hostname, 'jsonip.com')
    nock.emitter.removeAllListeners('no match');
    nock.enableNetConnect();
    t.end();
  });
  http.get('http://jsonip.com').once('error', ignore);
});

function ignore() {}
