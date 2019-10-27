'use strict'

// Tests for invoking `.reply()` with a function which invokes the error-first
// callback with the response body or an array containing the status code and
// optional response body and headers.

const { test } = require('tap')
const { expect } = require('chai')
const assertRejects = require('assert-rejects')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('reply can take a callback', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, (path, requestBody, callback) => callback(null, 'Hello World!'))

  const { body } = await got('http://example.test/', { encoding: null })

  expect(body).to.be.an.instanceOf(Buffer)
  expect(body.toString('utf8')).to.equal('Hello World!')
  scope.done()
})

test('reply takes a callback for status code', async t => {
  const responseBody = 'Hello, world!'

  const scope = nock('http://example.test')
    .get('/')
    .reply((path, requestBody, cb) => {
      setTimeout(
        () => cb(null, [202, responseBody, { 'X-Custom-Header': 'abcdef' }]),
        1
      )
    })

  const { statusCode, headers, body } = await got('http://example.test/')

  expect(statusCode).to.equal(202)
  expect(headers).to.deep.equal({ 'x-custom-header': 'abcdef' })
  expect(body).to.equal(responseBody)
  scope.done()
})

test('reply should throw on error on the callback', async t => {
  nock('http://example.test')
    .get('/')
    .reply(500, (path, requestBody, callback) =>
      callback(new Error('Database failed'))
    )

  await assertRejects(
    got('http://example.test'),
    got.RequestError,
    'Database failed'
  )
})

test('an error passed to the callback propagates when [err, fullResponseArray] is expected', async t => {
  nock('http://example.test')
    .get('/')
    .reply((path, requestBody, callback) => {
      callback(Error('boom'))
    })

  await assertRejects(got('http://example.test'), got.RequestError, 'boom')
})

test('subsequent calls to the reply callback are ignored', async t => {
  const replyFnCalled = sinon.spy()

  const scope = nock('http://example.test')
    .get('/')
    .reply(201, (path, requestBody, callback) => {
      replyFnCalled()
      callback(null, 'one')
      callback(null, 'two')
      callback(new Error('three'))
    })

  const { statusCode, body } = await got('http://example.test/')

  expect(replyFnCalled).to.have.been.calledOnce()
  expect(statusCode).to.equal(201)
  expect(body).to.equal('one')

  scope.done()
})

test('reply can take a status code with an 2-arg async function, and passes it the correct arguments', async t => {
  const scope = nock('http://example.com')
    .post('/foo')
    .reply(201, async (path, requestBody) => {
      expect(path).to.equal('/foo')
      expect(requestBody).to.equal('request-body')
      return 'response-body'
    })

  const { statusCode, body } = await got.post('http://example.com/foo', {
    body: 'request-body',
  })

  expect(statusCode).to.equal(201)
  expect(body).to.equal('response-body')
  scope.done()
})

test('reply can take a status code with a 0-arg async function, and passes it the correct arguments', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(async () => [201, 'Hello World!'])

  const { statusCode, body } = await got('http://example.com/')

  expect(statusCode).to.equal(201)
  expect(body).to.equal('Hello World!')
  scope.done()
})

test('when reply is called with a status code and an async function that throws, it propagates the error', async t => {
  nock('http://example.test')
    .get('/')
    .reply(201, async () => {
      throw Error('oh no!')
    })

  await assertRejects(got('http://example.test'), got.RequestError, 'oh no!')
})

test('when reply is called with an async function that throws, it propagates the error', async t => {
  nock('http://example.test')
    .get('/')
    .reply(async () => {
      throw Error('oh no!')
    })

  await assertRejects(got('http://example.test'), got.RequestError, 'oh no!')
})
