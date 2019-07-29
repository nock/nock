'use strict'

// Tests for invoking `.reply()` with a function which invokes the error-first
// callback with the response body or an array containing the status code and
// optional response body and headers.

const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('reply can take a callback', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, (path, requestBody, callback) => callback(null, 'Hello World!'))

  const response = await got('http://example.test/', {
    encoding: null,
  })

  scope.done()
  t.type(response.body, Buffer)
  t.equal(response.body.toString('utf8'), 'Hello World!')
})

test('reply takes a callback for status code', async t => {
  const expectedStatusCode = 202
  const responseBody = 'Hello, world!'
  const headers = {
    'X-Custom-Header': 'abcdef',
  }

  const scope = nock('http://example.test')
    .get('/')
    .reply((path, requestBody, cb) => {
      setTimeout(() => cb(null, [expectedStatusCode, responseBody, headers]), 1)
    })

  const response = await got('http://example.test/')

  t.equal(response.statusCode, expectedStatusCode, 'sends status code')
  t.deepEqual(
    response.headers,
    { 'x-custom-header': 'abcdef' },
    'sends headers'
  )
  t.equal(response.body, responseBody, 'sends request body')
  scope.done()
})

test('reply should throw on error on the callback', async t => {
  nock('http://example.test')
    .get('/')
    .reply(500, (path, requestBody, callback) =>
      callback(new Error('Database failed'))
    )

  await t.rejects(got('http://example.test'), {
    name: 'RequestError',
    message: 'Database failed',
  })
})

test('an error passed to the callback propagates when [err, fullResponseArray] is expected', async t => {
  nock('http://example.test')
    .get('/')
    .reply((path, requestBody, callback) => {
      callback(Error('boom'))
    })

  await t.rejects(got('http://example.test'), {
    name: 'RequestError',
    message: 'boom',
  })
})

test('subsequent calls to the reply callback are ignored', async t => {
  t.plan(3)

  const scope = nock('http://example.test')
    .get('/')
    .reply(201, (path, requestBody, callback) => {
      callback(null, 'one')
      callback(null, 'two')
      callback(new Error('three'))
      t.pass()
    })

  const { statusCode, body } = await got('http://example.test/')

  scope.done()
  t.is(statusCode, 201)
  t.equal(body, 'one')
})

test('reply can take a status code with an 2-arg async function, and passes it the correct arguments', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, async (path, requestBody) => {
      t.equal(path, '/')
      t.equal(requestBody, '')
      return 'Hello World!'
    })

  const response = await got('http://example.com/')

  t.equal(response.body, 'Hello World!')
  scope.done()
})

test('reply can take a status code with a 0-arg async function, and passes it the correct arguments', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(async () => [201, 'Hello World!'])

  const response = await got('http://example.com/')

  t.equal(response.statusCode, 201)
  t.equal(response.body, 'Hello World!')
  scope.done()
})

test('when reply is called with a status code and an async function that throws, it propagates the error', async t => {
  nock('http://example.test')
    .get('/')
    .reply(201, async () => {
      throw Error('oh no!')
    })

  await t.rejects(got('http://example.test'), {
    name: 'RequestError',
    message: 'oh no!',
  })
})

test('when reply is called with an async function that throws, it propagates the error', async t => {
  nock('http://example.test')
    .get('/')
    .reply(async () => {
      throw Error('oh no!')
    })

  t.rejects(got('http://example.test'), {
    name: 'RequestError',
    message: 'oh no!',
  })
})
