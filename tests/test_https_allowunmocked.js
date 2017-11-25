'use strict';

var test          = require('tap').test;
var mikealRequest = require('request');
var nock          = require('../');

nock.enableNetConnect();

test('allowUnmocked for https', {skip: process.env.AIRPLANE}, function(t) {
  nock('https://www.google.com/', {allowUnmocked: true})
  .get('/pathneverhit')
  .reply(200, {foo: 'bar'});

  var options = {
    method: 'GET',
    uri: 'https://www.google.com'
  };

  mikealRequest(options, function(err, resp, body) {
    t.notOk(err, 'should be no error');
    t.true(typeof body !== 'undefined', 'body should not be undefined');
    t.true(body.length !== 0, 'body should not be empty');
    t.end();
  });
});

test('allowUnmocked for https with query test miss', {skip: process.env.AIRPLANE}, function(t) {
  nock.cleanAll();
  nock('https://www.google.com', {allowUnmocked: true})
    .get('/search')
    .query(function() {return false;})
    .reply(500);

  var options = {
    method: 'GET',
    uri: 'https://www.google.com/search'
  };

  mikealRequest(options, function(err, resp, body) {
    t.notOk(err, 'should be no error');
    t.true(typeof body !== 'undefined', 'body should not be undefined');
    t.true(body.length !== 0, 'body should not be empty');
    t.end();
  });
});
