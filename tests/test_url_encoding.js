'use strict'

const nock = require('../')
const test = require('tap').test
const mikealRequest = require('request')
const assert = require('assert')

test('url encoding', function(t) {
  nock('http://encodingsareus.com')
    .get('/key?a=[1]')
    .reply(200)

  mikealRequest('http://encodingsareus.com/key?a=[1]', function(err, res) {
    if (err) throw err
    assert.equal(res.statusCode, 200)
    t.end()
  })
})
