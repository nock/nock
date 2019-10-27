'use strict'

// Tests for header objects passed to `.reply()`, including header objects
// containing lambdas.

const { IncomingMessage } = require('http')
const { test } = require('tap')
const { expect } = require('chai')
const sinon = require('sinon')
const mikealRequest = require('request')
const lolex = require('lolex')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('reply headers directly with a raw array', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!', [
      'X-My-Header',
      'My Header value',
      'X-Other-Header',
      'My Other Value',
    ])

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  expect(rawHeaders).to.deep.equal([
    'X-My-Header',
    'My Header value',
    'X-Other-Header',
    'My Other Value',
  ])
  scope.done()
})

test('reply headers directly with an object', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!', { 'X-My-Headers': 'My Header value' })

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({ 'x-my-headers': 'My Header value' })
  expect(rawHeaders).to.deep.equal(['X-My-Headers', 'My Header value'])
  scope.done()
})

test('reply headers directly with a Map', async t => {
  const replyHeaders = new Map([
    ['X-My-Header', 'My Header value'],
    ['X-Other-Header', 'My Other Value'],
  ])
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!', replyHeaders)

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  expect(rawHeaders).to.deep.equal([
    'X-My-Header',
    'My Header value',
    'X-Other-Header',
    'My Other Value',
  ])
  scope.done()
})

test('reply headers dynamically with a raw array', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [
      200,
      'Hello World!',
      ['X-My-Header', 'My Header value', 'X-Other-Header', 'My Other Value'],
    ])

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  expect(rawHeaders).to.deep.equal([
    'X-My-Header',
    'My Header value',
    'X-Other-Header',
    'My Other Value',
  ])
  scope.done()
})

test('reply headers dynamically with an object', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [200, 'Hello World!', { 'X-My-Headers': 'My Header value' }])

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({ 'x-my-headers': 'My Header value' })
  expect(rawHeaders).to.deep.equal(['X-My-Headers', 'My Header value'])
  scope.done()
})

test('reply headers dynamically with a Map', async t => {
  const replyHeaders = new Map([
    ['X-My-Header', 'My Header value'],
    ['X-Other-Header', 'My Other Value'],
  ])
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [200, 'Hello World!', replyHeaders])

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  expect(rawHeaders).to.deep.equal([
    'X-My-Header',
    'My Header value',
    'X-Other-Header',
    'My Other Value',
  ])
  scope.done()
})

test('reply headers throws for invalid data', async t => {
  const scope = nock('http://example.test').get('/')

  expect(() => scope.reply(200, 'Hello World!', 'foo: bar')).to.throw(
    Error,
    'Headers must be provided as an array of raw values, a Map, or a plain Object. foo: bar'
  )

  expect(() => scope.reply(200, 'Hello World!', false)).to.throw(
    Error,
    'Headers must be provided as an array of raw values, a Map, or a plain Object. false'
  )
})

test('reply headers throws for raw array with an odd number of items', async t => {
  const scope = nock('http://example.test').get('/')

  expect(() =>
    scope.reply(200, 'Hello World!', ['one', 'two', 'three'])
  ).to.throw(
    Error,
    'Raw headers must be provided as an array with an even number of items. [fieldName, value, ...]'
  )
})

test('reply header function is evaluated and the result sent in the mock response', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': () => 'yo!',
    })

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({ 'x-my-headers': 'yo!' })
  expect(rawHeaders).to.deep.equal(['X-My-Headers', 'yo!'])
  scope.done()
})

test('reply header function receives the correct arguments', async t => {
  const myHeaderFnCalled = sinon.spy()

  const { ClientRequest: OverriddenClientRequest } = require('http')
  const scope = nock('http://example.test')
    .post('/')
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => {
        myHeaderFnCalled()
        expect(req).to.be.an.instanceof(OverriddenClientRequest)
        expect(res).to.be.an.instanceof(IncomingMessage)
        expect(body).to.be.an.instanceof(Buffer)
        expect(Buffer.from('boo!').equals(body)).to.be.true()
        return 'gotcha'
      },
    })

  await got.post('http://example.test/')

  expect(myHeaderFnCalled).to.have.been.called()
  scope.done()
})

test('reply headers function is evaluated exactly once', async t => {
  const myHeaderFnCalled = sinon.spy()

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': () => {
        myHeaderFnCalled()
        return 'heya'
      },
    })

  await got('http://example.test/')

  expect(myHeaderFnCalled).to.have.been.calledOnce()
  scope.done()
})

test('duplicate reply headers function is evaluated once per input field name, in correct order', async t => {
  const replyHeaders = ['X-MY-HEADER', () => 'one', 'x-my-header', () => 'two']

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!', replyHeaders)

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({ 'x-my-header': 'one, two' })
  expect(rawHeaders).to.deep.equal(['X-MY-HEADER', 'one', 'x-my-header', 'two'])

  scope.done()
})

test('reply header function are re-evaluated for every matching request', async t => {
  let counter = 0
  const scope = nock('http://example.test')
    .get('/')
    .times(2)
    .reply(200, 'boo!', {
      'X-My-Headers': () => `${++counter}`,
    })

  const { headers, rawHeaders } = await got('http://example.test/')
  expect(headers).to.deep.equal({ 'x-my-headers': '1' })
  expect(rawHeaders).to.deep.equal(['X-My-Headers', '1'])

  expect(counter).to.equal(1)

  const { headers: headers2, rawHeaders: rawHeaders2 } = await got(
    'http://example.test/'
  )
  expect(headers2).to.deep.equal({ 'x-my-headers': '2' })
  expect(rawHeaders2).to.deep.equal(['X-My-Headers', '2'])

  expect(counter).to.equal(2)

  scope.done()
})

// https://nodejs.org/api/http.html#http_message_headers
test('duplicate headers are folded the same as Node', async t => {
  const replyHeaders = [
    'Content-Type',
    'text/html; charset=utf-8',
    'set-cookie',
    ['set-cookie1=foo', 'set-cookie2=bar'],
    'set-cookie',
    'set-cookie3=baz',
    'CONTENT-TYPE',
    'text/xml',
    'cookie',
    'cookie1=foo; cookie2=bar',
    'cookie',
    'cookie3=baz',
    'x-custom',
    'custom1',
    'X-Custom',
    ['custom2', 'custom3'],
  ]
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!', replyHeaders)

  const { headers, rawHeaders } = await got('http://example.test/')

  expect(headers).to.deep.equal({
    'content-type': 'text/html; charset=utf-8',
    'set-cookie': ['set-cookie1=foo', 'set-cookie2=bar', 'set-cookie3=baz'],
    cookie: 'cookie1=foo; cookie2=bar; cookie3=baz',
    'x-custom': 'custom1, custom2, custom3',
  })
  expect(rawHeaders).to.deep.equal(replyHeaders)

  scope.done()
})

test('replyContentLength() sends explicit content-length header with response', async t => {
  const response = { hello: 'world' }

  const scope = nock('http://example.test')
    .replyContentLength()
    .get('/')
    .reply(200, response)

  const { headers } = await got('http://example.test/')

  expect(headers['content-length']).to.equal(
    `${JSON.stringify(response).length}`
  )
  scope.done()
})

test('replyDate() sends explicit date header with response', async t => {
  const date = new Date()

  const scope = nock('http://example.test')
    .replyDate(date)
    .get('/')
    .reply()

  const { headers } = await got('http://example.test/')

  expect(headers.date).to.equal(date.toUTCString())
  scope.done()
})

// async / got version is returning "not ok test unfinished".
// https://github.com/nock/nock/issues/1305#issuecomment-451701657
test('replyDate() sends date header with response', t => {
  const clock = lolex.install()
  const date = new Date()

  t.on('end', () => {
    clock.uninstall()
  })

  const scope = nock('http://example.test')
    .replyDate()
    .get('/')
    .reply()

  mikealRequest.get('http://example.test', (err, resp) => {
    expect(err).to.be.null()
    expect(resp.headers.date).to.equal(date.toUTCString())
    scope.done()
    t.end()
  })
})
