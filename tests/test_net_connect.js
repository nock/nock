'use strict'

const nock = require('../')
const { test } = require('tap')
const mikealRequest = require('request')
const assert = require('assert')

test('disable net connect is default', function(t) {
  nock.disableNetConnect()
  nock('http://example.test')
    .get('/')
    .reply(200)

  mikealRequest('https://google.com/', function(err, res) {
    assert(err)
    assert.equal(
      err.message,
      'Nock: Disallowed net connect for "google.com:443/"'
    )
    t.end()
  })
})
