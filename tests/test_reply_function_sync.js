'use strict'

// Tests for invoking `.reply()` with a synchronous function which return the
// response body or an array containing the status code and optional response
// body and headers.

const assertRejects = require('assert-rejects')
const { test } = require('tap')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('reply with status code and function returning body as string', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => 'OK!')

  const { statusCode, body } = await got('http://example.test')
  expect(statusCode).to.equal(201)
  expect(body)
    .to.be.a('string')
    .and.to.equal('OK!')
  scope.done()
})

test('reply with status code and function returning body object', async t => {
  const exampleResponse = { message: 'OK!' }

  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => exampleResponse)

  const { statusCode, body } = await got('http://example.test')
  expect(statusCode).to.equal(201)
  expect(body)
    .to.be.a('string')
    .and.to.equal(JSON.stringify(exampleResponse))
  scope.done()
})

test('reply with status code and function returning body as number', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => 123)

  const { statusCode, body } = await got('http://example.test')
  expect(statusCode).to.equal(201)
  expect(body)
    .to.be.a('string')
    .and.to.equal('123')
  scope.done()
})

test('reply with status code and function returning array', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => [123])

  const { statusCode, body } = await got('http://example.test')
  expect(statusCode).to.equal(201)
  expect(body)
    .to.be.a('string')
    .and.to.equal('[123]')
  scope.done()
})

test('reply with status code and function returning a native boolean', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => false)

  const { statusCode, body } = await got('http://example.test')
  expect(statusCode).to.equal(201)
  expect(body)
    .to.be.a('string')
    .and.to.equal('false')
  scope.done()
})

test('reply with status code and function returning a native null', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => null)

  const { statusCode, body } = await got('http://example.test')
  expect(statusCode).to.equal(201)
  expect(body)
    .to.be.a('string')
    .and.to.equal('null')
  scope.done()
})

test('reply function with string body using POST', async t => {
  const exampleRequestBody = 'key=val'
  const exampleResponseBody = 'foo'

  const scope = nock('http://example.test')
    .post('/endpoint', exampleRequestBody)
    .reply(404, () => exampleResponseBody)

  await assertRejects(
    got.post('http://example.test/endpoint', { body: exampleRequestBody }),
    ({ statusCode, body }) => {
      expect(statusCode).to.equal(404)
      expect(body).to.equal(exampleResponseBody)
      return true
    }
  )
  scope.done()
})

test('reply function receives the request URL and body', async t => {
  const exampleRequestBody = 'key=val'
  const replyFnCalled = sinon.spy()

  const scope = nock('http://example.test')
    .post('/endpoint', exampleRequestBody)
    .reply(404, (uri, requestBody) => {
      replyFnCalled()
      expect(uri).to.equal('/endpoint')
      expect(requestBody).to.equal(exampleRequestBody)
    })

  await assertRejects(
    got('http://example.test/endpoint', {
      body: exampleRequestBody,
    }),
    ({ statusCode, body }) => {
      expect(statusCode).to.equal(404)
      expect(body).to.equal('')
      return true
    }
  )

  expect(replyFnCalled).to.have.been.called()
  scope.done()
})

test('when content-type is json, reply function receives parsed body', async t => {
  const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })
  const replyFnCalled = sinon.spy()

  const scope = nock('http://example.test')
    .post('/')
    .reply(201, (uri, requestBody) => {
      replyFnCalled()
      expect(requestBody)
        .to.be.an('object')
        .and.to.deep.equal(JSON.parse(exampleRequestBody))
    })

  const { statusCode } = await got('http://example.test/', {
    headers: { 'Content-Type': 'application/json' },
    body: exampleRequestBody,
  })
  expect(replyFnCalled).to.have.been.called()
  expect(statusCode).to.equal(201)
  scope.done()
})

// Regression test for https://github.com/nock/nock/issues/1642
test('when content-type is json (as array), reply function receives parsed body', async t => {
  const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })
  const replyFnCalled = sinon.spy()

  const scope = nock('http://example.test')
    .post('/')
    .reply(201, (uri, requestBody) => {
      replyFnCalled()
      expect(requestBody)
        .to.be.an('object')
        .and.to.to.deep.equal(JSON.parse(exampleRequestBody))
    })

  const { statusCode } = await got('http://example.test/', {
    // Providing the field value as an array is probably a bug on the callers behalf,
    // but it is still allowed by Node
    headers: { 'Content-Type': ['application/json', 'charset=utf8'] },
    body: exampleRequestBody,
  })
  expect(replyFnCalled).to.have.been.called()
  expect(statusCode).to.equal(201)
  scope.done()
})

test('without content-type header, body sent to reply function is not parsed', async t => {
  const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })
  const replyFnCalled = sinon.spy()

  const scope = nock('http://example.test')
    .post('/')
    .reply(201, (uri, requestBody) => {
      replyFnCalled()
      expect(requestBody)
        .to.be.a('string')
        .and.to.equal(exampleRequestBody)
    })

  const { statusCode } = await got.post('http://example.test/', {
    body: exampleRequestBody,
  })
  expect(replyFnCalled).to.have.been.called()
  expect(statusCode).to.equal(201)
  scope.done()
})

// This signature is supported today, however it seems unnecessary. This is
// just as easily accomplished with a function returning an array:
// `.reply(() => [201, 'ABC', { 'X-My-Headers': 'My custom header value' }])`
test('reply with status code, function returning string body, and header object', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201, () => 'ABC', { 'X-My-Headers': 'My custom header value' })

  const { headers } = await got('http://example.test/')

  expect(headers).to.deep.equal({ 'x-my-headers': 'My custom header value' })

  scope.done()
})

test('reply function returning array with only status code', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202])

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(202)
  expect(body).to.equal('')
  scope.done()
})

test('reply function returning array with status code and string body', async t => {
  const exampleResponse = 'This is a body'
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [401, exampleResponse])

  await assertRejects(got('http://example.test/'), ({ statusCode, body }) => {
    expect(statusCode).to.equal(401)
    expect(body).to.equal(exampleResponse)
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

  expect(statusCode).to.equal(202)
  expect(body).to.equal(JSON.stringify(exampleResponse))
  scope.done()
})

test('reply function returning array with status code and body as number', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202, 123])

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(202)
  expect(body)
    .to.be.a('string')
    .and.to.to.equal('123')
  scope.done()
})

test('reply function returning array with status code, string body, and headers object', async t => {
  const exampleBody = 'this is the body'
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202, exampleBody, { 'x-key': 'value', 'x-key-2': 'value 2' }])

  const { statusCode, body, headers, rawHeaders } = await got(
    'http://example.test/'
  )

  expect(statusCode).to.equal(202)
  expect(body).to.equal(exampleBody)
  expect(headers).to.deep.equal({
    'x-key': 'value',
    'x-key-2': 'value 2',
  })
  expect(rawHeaders).to.deep.equal(['x-key', 'value', 'x-key-2', 'value 2'])
  scope.done()
})

test('one function not returning an array causes an error', async t => {
  nock('http://example.test')
    .get('/abc')
    .reply(() => 'ABC')

  await assertRejects(got('http://example.test/abc'), err => {
    expect(err)
      .to.be.an.instanceOf(Error)
      .and.include({
        message: 'A single function provided to .reply MUST return an array',
      })
    return true
  })
  t.end()
})

test('one function returning an empty array causes an error', async t => {
  nock('http://example.test')
    .get('/abc')
    .reply(() => [])

  await assertRejects(got('http://example.test/abc'), err => {
    expect(err)
      .to.be.an.instanceOf(Error)
      .and.include({
        message: 'Invalid undefined value for status code',
      })
    return true
  })
  t.end()
})

test('one function returning too large an array causes an error', async t => {
  nock('http://example.test')
    .get('/abc')
    .reply(() => ['user', 'probably', 'intended', 'this', 'to', 'be', 'JSON'])

  await assertRejects(got('http://example.test/abc'), err => {
    expect(err)
      .to.be.an.instanceOf(Error)
      .and.include({
        message:
          'The array returned from the .reply callback contains too many values',
      })
    return true
  })
  t.end()
})

test('one function throws an error if extraneous args are provided', async t => {
  const interceptor = nock('http://example.test').get('/')

  expect(() =>
    interceptor.reply(() => [200], { 'x-my-header': 'some-value' })
  ).to.throw(Error, 'Invalid arguments')

  t.end()
})
