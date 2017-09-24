'use strict';

var nock = require('../');
var test = require('tap').test;
var mikealRequest = require('request');
var assert = require('assert');

test('match body with regex', function (t) {

  nock('http://encodingsareus.com')
    .post('/', {auth: {passwd: /a.+/}})
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: {
      auth: {
        passwd: 'abc'
      }
    },
  }, function(err, res) {
    if (err) throw err;
    assert.equal(res.statusCode, 200);
    t.end();
  });

});

test('match body with regex inside array', function (t) {

  nock('http://encodingsareus.com')
    .post('/', {items: [{name: /t.+/}]})
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: {
      items: [{
        name: 'test'
      }]
    },
  }, function(err, res) {
    if (err) throw err;
    assert.equal(res.statusCode, 200);
    t.end();
  });
})

test('match body with empty object inside', function (t) {

  nock('http://encodingsareus.com')
    .post('/', { obj: {}})
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: {
      obj: {}
    },
  }, function(err, res) {
    if (err) throw err;
    assert.equal(res.statusCode, 200);
    t.end();
  });
})

test('doesn\'t match body with mismatching keys', function (t) {
  nock('http://encodingsareus.com')
    .post('/', { a: 'a' })
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: {
      a: 'a',
      b: 'b'
    }
  }, function(err) {
    assert.ok(err);
    t.end();
  });
});

test('match body with form multipart', function(t) {

  nock('http://encodingsareus.com')
    .post('/', "--fixboundary\r\nContent-Disposition: form-data; name=\"field\"\r\n\r\nvalue\r\n--fixboundary--\r\n")
    .reply(200);

  var r = mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
  }, function(err, res) {
    if (err) throw err;
    assert.equal(res.statusCode, 200);
    t.end();
  });
  var form = r.form();
  form._boundary = 'fixboundary';  // fix boundary so that request could match at all
  form.append('field', 'value');
});
