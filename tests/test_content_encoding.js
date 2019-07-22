'use strict'

const assertRejects = require('assert-rejects')
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

test('Delaying the body is not available with content encoded responses', async t => {
  const message = 'Lorem ipsum dolor sit amet'
  const compressed = zlib.gzipSync(message)

  nock('http://example.test')
    .get('/')
    .delay({
      body: 100,
    })
    .reply(200, compressed, {
      'Content-Encoding': 'gzip',
    })

  await assertRejects(got('http://example.test/'), err => {
    t.match(
      err,
      Error(
        'Response delay of the body is currently not supported with content-encoded responses.'
      )
    )
    return true
  })
})
