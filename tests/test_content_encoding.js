'use strict'

const zlib = require('zlib')
const { test } = require('tap')
const got = require('got')
const nock = require('../.')

test('accepts gzipped content', async t => {
  const message = 'Lorem ipsum dolor sit amet'
  const compressed = zlib.gzipSync(message)

  nock('http://example.com')
    .get('/foo')
    .reply(200, compressed, {
      'X-Transfer-Length': String(compressed.length),
      'Content-Length': undefined,
      'Content-Encoding': 'gzip',
    })
  const { body } = await got('http://example.com/foo')

  t.equal(body, message)
})
