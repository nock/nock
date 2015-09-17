'use strict';

var nock = require('../');
var request = require('request');
var test = require('tap').test;

test('basic auth with username and password', function(t) {
  t.plan(2);

  nock('http://super-secure.com')
    .get('/test')
    .basicAuth({
      user: 'foo',
      pass: 'bar'
    })
    .reply(200, 'Here is the content');

  t.test('succeeds when it matches', function (tt) {
    request({
      url: 'http://super-secure.com/test',
      auth: {
        user: 'foo',
        pass: 'bar'
      }
    }, function(err, res, body) {
      if (err) {
        throw err;
      }
      tt.equal(res.statusCode, 200);
      tt.equal(body, 'Here is the content');
      tt.end();
    });
  });

  t.test('fails when it doesnt match', function (tt) {
    request({
      url: 'http://super-secure.com/test',
    }, function(err, res, body) {
      tt.type(err, 'Error');
      tt.end();
    });
  });
});

test('basic auth with username only', function(t) {
  t.plan(2);

  nock('http://super-secure.com')
    .get('/test')
    .basicAuth({
      user: 'foo'
    })
    .reply(200, 'Here is the content');

  t.test('succeeds when it matches', function (tt) {
    request({
      url: 'http://super-secure.com/test',
      auth: {
        user: 'foo'
      }
    }, function(err, res, body) {
      if (err) {
        throw err;
      }
      tt.equal(res.statusCode, 200);
      tt.equal(body, 'Here is the content');
      tt.end();
    });
  });

  t.test('fails when it doesnt match', function (tt) {
    request({
      url: 'http://super-secure.com/test',
    }, function(err, res, body) {
      tt.type(err, 'Error');
      tt.end();
    });
  });
});
