'use strict';

var Scope    = require('../lib/scope')
  , assert = require('assert')
  , tap     = require('tap')
  , testcases = require('./fixtures/root-paths-cases.json')
  , _       = require('lodash');

testcases.forEach(function(cas) {
  tap.test(`Scope parsing of root url: ${cas.root}`, function (t) {
    let s = Scope(cas.root);
    assert.equal(s.basePath, cas.basePath);
    t.end();
  });
});
