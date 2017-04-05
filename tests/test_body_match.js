'use strict';

var nock = require('../');
var test = require('tap').test;
var mikealRequest = require('request');
var assert = require('assert');

var testBodyMatch = function (expected, actual, shouldMatch, t) {
  nock('http://encodingsareus.com')
    .post('/', expected)
    .reply(200);

  mikealRequest({
    url: 'http://encodingsareus.com/',
    method: 'post',
    json: actual,
  }, function(err, res) {
    shouldMatch
      ? assert.equal(res.statusCode, 200)
      : assert(err && /No match for request/.test(err.message), 'nock should not intercept the request');
      t.end();
  });
}


test('body matching', function (t) {
  t.test('match body with regex', function (t2) {
    testBodyMatch({auth: {passwd: /a.+/}}, {auth: {passwd: 'abc'}}, true, t2);
  });

  t.test('match body with regex inside array', function (t2) {
    testBodyMatch({items: [{name: /t.+/}]}, {items: [{name: 'test'}]}, true, t2);
  });

  t.test('failing body matching with regex inside array', function (t2) {
    testBodyMatch({items: [{name: /o.+/}]}, {items: [{name: 'test'}]}, false, t2);
  });

  t.test('failing body matching with different array length', function (t2) {
    testBodyMatch({items: [1, 2]}, {items: [{items: [1, 2, 3]}]}, false, t2);
  });

  t.test('match body with empty object inside', function (t2) {
    testBodyMatch({ obj: {}}, {obj: {}}, true, t2);
  });

  t.test('match body with identical objects', function (t2) {
    testBodyMatch({ obj: {b:1, a:1}}, {obj: {b:1, a:1}}, true, t2);
  });

  t.test('failing body matching with different objects', function (t2) {
    testBodyMatch({ obj: {a:1}}, {obj: {b:1, a:1}}, false, t2);
  });

  t.test('failing body matching with different nested objects', function (t2) {
    testBodyMatch({ obj: {a: {b:1}}}, {obj: {a: {b:1, c:1}}}, false, t2);
  });
  t.end();
});
