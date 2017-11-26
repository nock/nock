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

  http.get('http://eventland/please');
});

test('emits global no match when no match and no mock', function(t) {
  nock.emitter.once('no match', function(req) {
    t.end();
  });

  var req = http.get('http://doesnotexistandneverexistedbefore/abc');
  req.once('error', ignore);
});

test('emits global no match when no match and mocked', function(t) {

  nock('http://itmayormaynotexistidontknowreally')
    .get('/')
    .reply('howdy');


  var assertion = function(req) {
    t.equal(req.path, '/definitelymaybe');
    nock.emitter.removeAllListeners('no match');
    t.end();
  }
  nock.emitter.on('no match', assertion);

  http.get('http://itmayormaynotexistidontknowreally/definitelymaybe')
    .once('error', ignore);
});

test('emits global no match when netConnect is disabled', function(t) {
  nock.disableNetConnect();
  nock.emitter.on('no match', function(req) {
    t.equal(req.hostname, 'jsonip.com')
    nock.emitter.removeAllListeners('no match');
    nock.enableNetConnect();
    t.end();
  });
  http.get('http://jsonip.com').once('error', ignore);
});

test('emits global request when match and mock', function(t) {
  nock('http://eventland')
    .post('/please')
    .reply(200);

  nock.emitter.once('request', function(req, options, body) {
    t.equal(options.path, '/please');
    // var parsedBody = JSON.parse(body);
    // t.same(parsedBody, { foo: 'bar'});
    t.end();
  });

  var req = http.request({ hostname: 'eventland', path: '/please', method: 'POST' });
  req.write(JSON.stringify({ foo: 'bar' }));
  req.end();
})

test('emits global request when no match and no mock', function(t) {
  nock.emitter.once('request', function(req, options, body) {
    t.equal(options.path, '/abc');
    // var parsedBody = JSON.parse(body);
    // t.same(parsedBody, { foo: 'bar' });
    t.end();
  });

  var req = http.request({ hostname: 'doesnotexistandneverexistedbefore', path: '/abc', method: 'POST' });
  req.write(JSON.stringify({ foo: 'bar' }));
  req.once('error', ignore);
  req.end();
});

test('emits global request when no match and mocked', function(t) {
  nock('http://itmayormaynotexistidontknowreally')
    .get('/')
    .reply('howdy');

  nock.emitter.once('request', function(req, options, body) {
    t.equal(options.path, '/definitelymaybe');
    // var parsedBody = JSON.parse(body);
    // t.same(parsedBody, { foo: 'bar' });
    t.end();
  });

  var req = http.request({ hostname: 'itmayormaynotexistidontknowreally', path: '/definitelymaybe', method: 'POST' });
  req.write(JSON.stringify({ foo: 'bar' }));
  req.once('error', ignore);
  req.end();
});

test('emits global request when netConnect is disabled', function(t) {
  nock.disableNetConnect();
  nock.emitter.once('request', function(req, options, body) {
    t.equal(options.hostname, 'jsonip.com');
    // var parsedBody = JSON.parse(body);
    // t.same(parsedBody, { foo: 'bar' });
    nock.enableNetConnect();
    t.end();
  });
  var req = http.request({ hostname: 'jsonip.com', method: 'POST' });
  req.write(JSON.stringify({ foo: 'bar' }));
  req.once('error', ignore);
  req.end();
});

function ignore() {}
