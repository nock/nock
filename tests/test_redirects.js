'use strict'

const assert = require('assert')
const { test } = require('tap')
const mikealRequest = require('request')
const nock = require('../')

test('follows redirects', function(t) {
  nock('http://example.test')
    .get('/YourAccount')
    .reply(302, undefined, {
      Location: 'http://example.test/Login',
    })
    .get('/Login')
    .reply(200, 'Here is the login page')

  mikealRequest('http://example.test/YourAccount', function(err, res, body) {
    if (err) {
      throw err
    }

    assert.equal(res.statusCode, 200)
    assert.equal(body, 'Here is the login page')
    t.end()
  })
})
