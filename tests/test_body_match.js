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

test('match body with contentType x-www-form-urlencoded', function (t) {

  nock('http://encodingsareus.com')
    .post('/', {auth: {passwd: 'abc'}})
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    //`form` set the conent-type to application/x-www-form-urlencoded
    form: {
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
