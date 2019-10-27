'use strict'

// Tests for `.replyWithFile()`.

const path = require('path')
const { test } = require('tap')
const { expect } = require('chai')
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

  expect(statusCode).to.equal(200)
  expect(body).to.equal('Hello from the file!')

  scope.done()
})

test('reply with file with headers', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(200, binaryFile, {
      'content-encoding': 'gzip',
    })

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(200)
  expect(body).to.have.lengthOf(20)
  scope.done()
})

test('reply with file with no fs', t => {
  const { Scope: ScopeWithoutFs } = proxyquire('../lib/scope', {
    './interceptor': proxyquire('../lib/interceptor', { fs: null }),
  })

  expect(() =>
    new ScopeWithoutFs('http://example.test')
      .get('/')
      .replyWithFile(200, textFile)
  ).to.throw(Error, 'No fs')

  t.end()
})
