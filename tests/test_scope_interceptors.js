var nock = require('../');
var test = require('tap').test;
var http = require('http');

test('scope exposes interceptors', function(t) {
  nock.load(__dirname  + '/fixtures/goodRequest.json').forEach(function (scope) {
    scope.interceptors.forEach(function(interceptor) {
      interceptor.delayConnection(100);
    });
  });
  t.end();
});

test('.define respects `filterPath` in options', function(t) {
  var reqOpts = { method: 'GET', host: 'google.com', path: '/?query=42' };

  nock('http://google.com')
    .get('/')
    .reply(200, '');

  var req = http.request(reqOpts, function(res) {
    throw new Error('should not come here!');
  });
  req.on('error', function(err) {
    t.match(err.message, /Nock: No match for request/);
  });
  req.end();

  nock.cleanAll();
  nock('http://google.com', { filteringPath: function() { return '/'; } })
    .get('/')
    .reply(200, '');

  var req = http.request(reqOpts, function(res) { });
  req.on('error', function(err) {
    t.error(err);
  });
  req.end();

  nock.cleanAll();
  nock('http://google.com', { filteringPath: [/\?query=42/, ''] })
    .get('/')
    .reply(200, '');

  var req = http.request(reqOpts, function(res) {
    t.end();
  });
  req.on('error', function(err) {
    t.error(err);
  });
  req.end();
});
