'use strict'

// Tests for `.replyWithFile()`.

const path = require('path')
const { test } = require('tap')
const proxyquire = require('proxyquire').noPreserveCache()
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

const textFile = path.join(__dirname, '..', 'assets', 'reply_file_1.txt')
const binaryFile = path.join(__dirname, '..', 'assets', 'reply_file_2.txt.gz')

test('reply with file', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(200, textFile)

  const { statusCode, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.equal(body, 'Hello from the file!')

  scope.done()
})

test('reply with file with headers', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(200, binaryFile, {
      'content-encoding': 'gzip',
    })

  const { statusCode, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.equal(body.length, 20)
  scope.done()
})

test('reply with file with no fs', t => {
  const { Scope: ScopeWithoutFs } = proxyquire('../lib/scope', {
    './interceptor': proxyquire('../lib/interceptor', { fs: null }),
  })

  t.throws(
    () =>
      new ScopeWithoutFs('http://example.test')
        .get('/')
        .replyWithFile(200, textFile),
    {
      message: 'No fs',
    }
  )

  t.end()
})
