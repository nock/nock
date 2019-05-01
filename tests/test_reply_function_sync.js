'use strict'

// Tests for invoking `.reply()` with a synchronous function which return the
// response body or an array containing the status code and optional response
// body and headers.

const http = require('http')
const assertRejects = require('assert-rejects')
const { test } = require('tap')
const got = require('got')
const nock = require('..')

require('./cleanup_after_each')()

test('get with reply callback', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, () => 'OK!')

  const { body } = await got('http://example.com')
  t.equal(body, 'OK!')
  scope.done()
})

test('get with reply callback returning object', async t => {
  const exampleResponse = { message: 'OK!' }

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, () => exampleResponse)

  const { body } = await got('http://example.test')
  t.equal(body, JSON.stringify(exampleResponse))
  scope.done()
})

test('get with reply callback returning array with headers', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202, 'body', { 'x-key': 'value', 'x-key-2': 'value 2' }])

  const { headers, rawHeaders } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-key': 'value',
    'x-key-2': 'value 2',
  })
  t.deepEqual(rawHeaders, ['x-key', 'value', 'x-key-2', 'value 2'])
  scope.done()
})

test('reply headers work with function', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, () => 'ABC', { 'X-My-Headers': 'My custom header value' })

  const { headers } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'My custom header value' })
  scope.done()
})

// Skipped because https://github.com/nock/nock/issues/1222
test(
  'get with reply callback returning default statusCode without body',
  { skip: true },
  t => {
    nock('http://replyheaderland')
      .get('/')
      .reply((uri, requestBody) => [401])

    http.get(
      {
        host: 'replyheaderland',
        path: '/',
        port: 80,
      },
      res => {
        res.setEncoding('utf8')
        t.equal(res.statusCode, 200)
        res.on('data', data => {
          t.equal(data, '[401]')
          res.once('end', t.end.bind(t))
        })
      }
    )
  }
)

test('get with reply callback returning callback without headers', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(() => [401, 'This is a body'])

  await assertRejects(got('http://example.com/'), err => {
    t.equal(err.statusCode, 401)
    t.equal(err.body, 'This is a body')
    return true
  })
  scope.done()
})

test('post with reply callback, uri, and request body', async t => {
  const input = 'key=val'

  const scope = nock('http://example.com')
    .post('/echo', input)
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got('http://example.com/echo', { body: input })
  t.equal(body, 'OK /echo key=val')
  scope.done()
})

test("when request's content-type is json: reply callback's requestBody should automatically parse to JSON", async t => {
  const requestBodyFixture = {
    id: 1,
    name: 'bob',
  }

  const scope = nock('http://service')
    .post('/endpoint')
    .reply(200, (uri, requestBody) => {
      t.deepEqual(requestBody, requestBodyFixture)
      return 'overwrite'
    })

  const { body } = await got.post('http://service/endpoint', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBodyFixture),
  })

  t.equal(body, 'overwrite')
  scope.done()
})

test("when request has no content-type header: reply callback's requestBody should not automatically parse to JSON", async t => {
  const requestBodyFixture = {
    id: 1,
    name: 'bob',
  }

  const scope = nock('http://service')
    .post('/endpoint')
    .reply(200, (uri, requestBody) => {
      t.deepEqual(requestBody, JSON.stringify(requestBodyFixture))
      return 'overwrite'
    })

  const { body } = await got.post('http://service/endpoint', {
    body: JSON.stringify(requestBodyFixture),
  })

  t.equal(body, 'overwrite')
  scope.done()
})

test('reply should send correct statusCode with array-notation and without body', async t => {
  t.plan(1)

  const expectedStatusCode = 202

  const scope = nock('http://example.com')
    .get('/')
    .reply((path, requestBody) => [expectedStatusCode])

  const { statusCode } = await got('http://example.com/')

  t.equal(statusCode, expectedStatusCode)
  scope.done()
})
