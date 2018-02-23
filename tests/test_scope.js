'use strict';

var Scope    = require('../lib/scope')
  , assert = require('assert')
  , tap     = require('tap')
  , testcases = require('./fixtures/root-paths-cases.json')
  , _       = require('lodash')
  , request = require('superagent')
  , nock    = require('../.')
  , uuid = require('uuid/v1');

testcases.forEach(function(cas) {
  tap.test(`Scope parsing of root url: ${cas.root} matches expect basePath`,
  function (t) {
    let s = Scope(cas.root);
    assert.equal(s.basePath, cas.basePath);
    t.end();
  });
});

tap.test('Scope parsing of root url with trailing backslash is sanitized',
function(t) {
  let domain = 'http://foo.com'
  let s = Scope(domain + '/');
  assert.equal(s.basePath, domain);
  t.end();
});

testcases.forEach(function(cas) {
  tap.test(`nock called with ${cas.root}/foo intercepts requests`,
  function (t) {
    const expected = uuid();

    nock(cas.root)
      .get('/foo')
      .reply(200, expected);

    request
      .get(cas.basePath + '/foo')
      .end(function(err, res) {
        t.error(err);
        t.equal(res.statusCode, 200);
        t.equal(res.body, expected);
        t.end();
      });
  });
});
