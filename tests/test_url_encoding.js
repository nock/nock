'use strict'

const nock = require('../')
const { test } = require('tap')
const mikealRequest = require('request')
const assert = require('assert')

test('url encoding', function(t) {
  nock('http://example.test')
    .get('/key?a=[1]')
    .reply(200)

  mikealRequest('http://example.test/key?a=[1]', function(err, res) {
    if (err) throw err
    assert.equal(res.statusCode, 200)
    t.end()
  })
})
