'use strict'

// Tests for invoking `.reply()` with a function which invokes the error-first
// callback with the response body or an array containing the status code and
// optional response body and headers.

const assertRejects = require('assert-rejects')
const http = require('http')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('reply can take a callback', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, (path, requestBody, callback) => callback(null, 'Hello World!'))

  const response = await got('http://example.com/', {
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

  const scope = nock('http://example.com')
    .get('/')
    .reply((path, requestBody, cb) => {
      setTimeout(() => cb(null, [expectedStatusCode, responseBody, headers]), 1)
    })

  const response = await got('http://example.com/')

  t.equal(response.statusCode, expectedStatusCode, 'sends status code')
  t.deepEqual(
    response.headers,
    { 'x-custom-header': 'abcdef' },
    'sends headers'
  )
  t.equal(response.body, responseBody, 'sends request body')
  scope.done()
})

test('reply should throw on error on the callback', t => {
  let dataCalled = false

  const scope = nock('http://example.com')
    .get('/')
    .reply(500, (path, requestBody, callback) =>
      callback(new Error('Database failed'))
    )

  // TODO When this request is converted to `got`, it causes the request not
  // to match.
  const req = http.request(
    {
      host: 'example.com',
      path: '/',
      port: 80,
    },
    res => {
      t.equal(res.statusCode, 500, 'Status code is 500')

      res.on('data', data => {
        dataCalled = true
        t.ok(data instanceof Buffer, 'data should be buffer')
        t.ok(
          data.toString().indexOf('Error: Database failed') === 0,
          'response should match'
        )
      })

      res.on('end', () => {
        t.ok(dataCalled, 'data handler was called')
        scope.done()
        t.end()
      })
    }
  )

  req.end()
})

test('an error passed to the callback propagates when [err, fullResponseArray] is expected', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply((path, requestBody, callback) => {
      callback(Error('boom'))
    })

  await assertRejects(got('http://example.test/'), ({ statusCode, body }) => {
    t.is(statusCode, 500)
    t.matches(body, 'Error: boom')
    return true
  })

  scope.done()
})

test('subsequent calls to the reply callback are ignored', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(201, (path, requestBody, callback) => {
      callback(null, 'one')
      callback(null, 'two')
      callback(null, 'three')
    })

  const { statusCode, body } = await got('http://example.com/')

  scope.done()
  t.is(statusCode, 201)
  t.equal(body, 'one')
})
