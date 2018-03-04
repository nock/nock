'use strict';

var nock = require('../');
var test = require('tap').test;
var mikealRequest = require('request');
var assert = require('assert');

test('match body is regex trying to match string', function (t) {

  nock('http://encodingsareus.com')
    .post('/', new RegExp("a.+"))
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

test('match body (with space character) with regex', function (t) {

  nock('http://encodingsareus.com')
    .post('/', /a bc/)
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: {
      auth: {
        passwd: 'a bc'
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

test('match body with nested object inside', function (t) {

  nock('http://encodingsareus.com')
    .post('/', /x/)
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: {
      obj: {
        x: 1
      },
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

test('array like urlencoded form posts are correctly parsed', function(t) {

  nock('http://encodingsareus.com')
      .post('/',{
        arrayLike: [
          {
            "fieldA": "0",
            "fieldB": "data",
            "fieldC": "value"
          }
        ]
        })
      .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    form: {
      "arrayLike[0].fieldA": "0",
      "arrayLike[0].fieldB": "data",
      "arrayLike[0].fieldC": "value"
    }
  }, function(err, res) {
    if (err) throw err;
    assert.equal(res.statusCode, 200);
    t.end();
  });
});
