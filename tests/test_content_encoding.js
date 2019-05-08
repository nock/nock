'use strict'

const zlib = require('zlib')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('accepts gzipped content', async t => {
  const message = 'Lorem ipsum dolor sit amet'
  const compressed = zlib.gzipSync(message)

  nock('http://example.test')
    .get('/foo')
    .reply(200, compressed, {
      'X-Transfer-Length': String(compressed.length),
      'Content-Length': undefined,
      'Content-Encoding': 'gzip',
    })
  const { body, statusCode } = await got('http://example.test/foo')

  t.equal(body, message)
  t.equal(statusCode, 200)
})
