'use strict';

var test = require('tap').test;
var mikealRequest = require('request');

var ssl = require('./ssl')

// Do not copy tests that rely on the process.env.AIRPLANE, we are deprecating that via #1231
test('NOCK_OFF=true works for https', function (t) {
  var original = process.env.NOCK_OFF;
  process.env.NOCK_OFF = 'true';
  var nock = require('../');

  t.plan(4);

  function middleware (request, response) {
    t.pass('server received a request');
    response.writeHead(200);
    response.end('the real thing');
  }

  ssl.startServer(middleware, function (error, server) {
    t.error(error);

    var port = server.address().port
    var scope = nock(`https://localhost:${port}`, { allowUnmocked: true})
      .get('/')
      .reply(200, 'mock')

    var options = {
      method: 'GET',
      uri: `https://localhost:${port}`,
      ca: ssl.ca
    };

    mikealRequest(options, function (err, resp, body) {
      t.error(err);
      t.equal(body, 'the real thing');
      scope.done();
      process.env.NOCK_OFF = original;
      server.close(t.end);
    });
  });
});
