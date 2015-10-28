'use strict';

var nock = require('../');
var test = require('tap').test;
var http = require('http');

test("IPV6 URL in http.get get gets mocked", function(t) {
  var dataCalled = false;

  var scope = nock('http://[2607:f0d0:1002:51::4]:8080')
    .get('/')
    .reply(200, "Hello World!");

  http.get('http://[2607:f0d0:1002:51::4]:8080/', function(res) {
    t.equal(res.statusCode, 200, "Status code is 200");
    res.on('end', function() {
      t.ok(dataCalled, "data handler was called");
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "Hello World!", "response should match");
    });

  });
});

test("IPV6 hostname in http.request get gets mocked", function(t) {
  var dataCalled = false;

  var scope = nock('http://[2607:f0d0:1002:51::5]:8080')
    .get('/')
    .reply(200, "Hello World!");

  http.request({
    hostname: '2607:f0d0:1002:51::5',
    path: '/',
    method: 'GET',
    port: 8080,
  }, function(res) {
    t.equal(res.statusCode, 200, "Status code is 200");
    res.on('end', function() {
      t.ok(dataCalled, "data handler was called");
      scope.done();
      t.end();
    });
    res.on('data', function(data) {
      dataCalled = true;
      t.ok(data instanceof Buffer, "data should be buffer");
      t.equal(data.toString(), "Hello World!", "response should match");
    });
  }).end();
});