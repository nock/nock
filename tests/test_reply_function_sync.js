'use strict'

// Tests for invoking `.reply()` with a synchronous function which return the
// response body or an array containing the status code and optional response
// body and headers.

const assertRejects = require('assert-rejects')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('reply with status code and function returning body as string', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(201, () => 'OK!')

  const { statusCode, body } = await got('http://example.com')
  t.is(statusCode, 201)
  t.equal(body, 'OK!')
  scope.done()
})

test('reply with status code and function returning body object', async t => {
  const exampleResponse = { message: 'OK!' }

  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => exampleResponse)

  const { statusCode, body } = await got('http://example.test')
  t.is(statusCode, 201)
  t.equal(body, JSON.stringify(exampleResponse))
  scope.done()
})

test('reply with status code and function returning body as number', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => 123)

  const { statusCode, body } = await got('http://example.test')
  t.is(statusCode, 201)
  t.equal(body, '123')
  scope.done()
})

test('reply with status code and function returning array', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => [123])

  const { statusCode, body } = await got('http://example.test')
  t.is(statusCode, 201)
  t.equal(body, '[123]')
  scope.done()
})

test('reply function with string body using POST', async t => {
  const exampleRequestBody = 'key=val'
  const exampleResponseBody = 'foo'

  const scope = nock('http://example.test')
    .post('/endpoint', exampleRequestBody)
    .reply(404, () => exampleResponseBody)

  await assertRejects(
    got.post('http://example.test/endpoint', {
      body: exampleRequestBody,
    }),
    ({ statusCode, body }) => {
      t.is(statusCode, 404)
      t.equal(body, exampleResponseBody)
      return true
    }
  )
  scope.done()
})

test('reply function receives the request URL and body', async t => {
  t.plan(3)

  const exampleRequestBody = 'key=val'

  const scope = nock('http://example.test')
    .post('/endpoint', exampleRequestBody)
    .reply(404, (uri, requestBody) => {
      t.equal(uri, '/endpoint')
      t.equal(requestBody, exampleRequestBody)
    })

  await assertRejects(
    got('http://example.test/endpoint', {
      body: exampleRequestBody,
    }),
    ({ statusCode, body }) => {
      t.equal(statusCode, 404)
      return true
    }
  )
  scope.done()
})

test('when content-type is json, reply function receives parsed body', async t => {
  t.plan(4)
  const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })

  const scope = nock('http://example.test')
    .post('/')
    .reply(201, (uri, requestBody) => {
      t.type(requestBody, 'object')
      t.deepEqual(requestBody, JSON.parse(exampleRequestBody))
    })

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'Content-Type': 'application/json' },
    body: exampleRequestBody,
  })
  t.is(statusCode, 201)
  t.equal(body, '')
  scope.done()
})

test('without content-type header, body sent to reply function is not parsed', async t => {
  t.plan(4)
  const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })

  const scope = nock('http://example.test')
    .post('/')
    .reply(201, (uri, requestBody) => {
      t.type(requestBody, 'string')
      t.equal(requestBody, exampleRequestBody)
    })

  const { statusCode, body } = await got.post('http://example.test/', {
    body: exampleRequestBody,
  })
  t.is(statusCode, 201)
  t.equal(body, '')
  scope.done()
})

// This signature is supported today, however it seems unnecessary. This is
// just as easily accomplished with a function returning an array:
// `.reply(() => [201, 'ABC', { 'X-My-Headers': 'My custom header value' }])`
test('reply with status code, function returning string body, and header object', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(201, () => 'ABC', { 'X-My-Headers': 'My custom header value' })

  const { headers } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'My custom header value' })

  scope.done()
})

test('reply function returning array with status code', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202])

  const { statusCode, body } = await got('http://example.test/')

  t.equal(statusCode, 202)
  t.equal(body, '')
  scope.done()
})

test('reply function returning array with status code and string body', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(() => [401, 'This is a body'])

  await assertRejects(got('http://example.com/'), ({ statusCode, body }) => {
    t.is(statusCode, 401)
    t.equal(body, 'This is a body')
    return true
  })
  scope.done()
})

test('reply function returning array with status code and body object', async t => {
  const exampleResponse = { message: 'OK!' }

  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202, exampleResponse])

  const { statusCode, body } = await got('http://example.test/')

  t.is(statusCode, 202)
  t.equal(body, JSON.stringify(exampleResponse))
  scope.done()
})

test('reply function returning array with status code and body as number', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202, 123])

  const { statusCode, body } = await got('http://example.test/')

  t.is(statusCode, 202)
  t.type(body, 'string')
  t.equal(body, '123')
  scope.done()
})

test('reply function returning array with status code, string body, and headers object', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202, 'body', { 'x-key': 'value', 'x-key-2': 'value 2' }])

  const { statusCode, body, headers, rawHeaders } = await got(
    'http://example.test/'
  )

  t.is(statusCode, 202)
  t.equal(body, 'body')
  t.deepEqual(headers, {
    'x-key': 'value',
    'x-key-2': 'value 2',
  })
  t.deepEqual(rawHeaders, ['x-key', 'value', 'x-key-2', 'value 2'])
  scope.done()
})
