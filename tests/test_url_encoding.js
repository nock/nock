'use strict'

const { test } = require('tap')
const mikealRequest = require('request')
const nock = require('..')

require('./cleanup_hook')()

test('url encoding', t => {
  nock('http://example.test')
    .get('/key?a=[1]')
    .reply(200)

  mikealRequest('http://example.test/key?a=[1]', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})
