'use strict'

const assertRejects = require('assert-rejects')
const { expect } = require('chai')
const { test } = require('tap')
const zlib = require('zlib')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('accepts gzipped content', async () => {
  const message = 'Lorem ipsum dolor sit amet'
  const compressed = zlib.gzipSync(message)

  const scope = nock('http://example.test')
    .get('/foo')
    .reply(200, compressed, {
      'X-Transfer-Length': String(compressed.length),
      'Content-Length': undefined,
      'Content-Encoding': 'gzip',
    })
  const { body, statusCode } = await got('http://example.test/foo')

  expect(statusCode).to.equal(200)
  expect(body).to.equal(message)
  scope.done()
})

test('Delaying the body is not available with content encoded responses', async () => {
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

  await assertRejects(
    got('http://example.test/'),
    /Response delay of the body is currently not supported with content-encoded responses/
  )
})
