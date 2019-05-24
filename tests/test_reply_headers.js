'use strict'

// Tests for header objects passed to `.reply()`, including header objects
// containing lambdas.

const { IncomingMessage } = require('http')
const { test } = require('tap')
const mikealRequest = require('request')
const lolex = require('lolex')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

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

  t.equivalent(headers, {
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  t.equivalent(rawHeaders, [
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

  t.equivalent(headers, { 'x-my-headers': 'My Header value' })
  t.equivalent(rawHeaders, ['X-My-Headers', 'My Header value'])
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

  t.equivalent(headers, {
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  t.equivalent(rawHeaders, [
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

  t.equivalent(headers, {
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  t.equivalent(rawHeaders, [
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

  t.equivalent(headers, { 'x-my-headers': 'My Header value' })
  t.equivalent(rawHeaders, ['X-My-Headers', 'My Header value'])
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

  t.equivalent(headers, {
    'x-my-header': 'My Header value',
    'x-other-header': 'My Other Value',
  })
  t.equivalent(rawHeaders, [
    'X-My-Header',
    'My Header value',
    'X-Other-Header',
    'My Other Value',
  ])
  scope.done()
})

test('reply headers throws for invalid data', async t => {
  const scope = nock('http://example.test').get('/')

  t.throws(() => scope.reply(200, 'Hello World!', 'foo: bar'), {
    message:
      'Headers must be provided as an array of raw values, a Map, or a plain Object. foo: bar',
  })

  t.done()
})

test('reply header function is evaluated and the result sent in the mock response', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': () => 'yo!',
    })

  const { headers, rawHeaders } = await got('http://example.test/')

  t.equivalent(headers, { 'x-my-headers': 'yo!' })
  t.equivalent(rawHeaders, ['X-My-Headers', 'yo!'])
  scope.done()
})

test('reply header function receives the correct arguments', async t => {
  t.plan(4)

  const { ClientRequest: OverriddenClientRequest } = require('http')
  const scope = nock('http://example.test')
    .post('/')
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => {
        t.type(req, OverriddenClientRequest)
        t.type(res, IncomingMessage)
        t.type(body, Buffer)
        t.true(Buffer.from('boo!').equals(body))
        return 'gotcha'
      },
    })

  await got.post('http://example.test/')

  scope.done()
})

test('reply headers function is evaluated exactly once', async t => {
  let counter = 0
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': () => {
        ++counter
        return 'heya'
      },
    })

  await got('http://example.test/')

  scope.done()

  t.equal(counter, 1)
})

test('duplicate reply headers function is evaluated once per input field name, in correct order', async t => {
  const replyHeaders = ['X-MY-HEADER', () => 'one', 'x-my-header', () => 'two']

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!', replyHeaders)

  const { headers, rawHeaders } = await got('http://example.test/')

  t.equivalent(headers, {
    'x-my-header': 'one, two',
  })
  t.equivalent(rawHeaders, ['X-MY-HEADER', 'one', 'x-my-header', 'two'])

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
  t.equivalent(headers, { 'x-my-headers': '1' })
  t.equivalent(rawHeaders, ['X-My-Headers', '1'])

  t.equal(counter, 1)

  const { headers: headers2, rawHeaders: rawHeaders2 } = await got(
    'http://example.test/'
  )
  t.equivalent(headers2, { 'x-my-headers': '2' })
  t.equivalent(rawHeaders2, ['X-My-Headers', '2'])

  t.equal(counter, 2)

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

  t.equivalent(headers, {
    'content-type': 'text/html; charset=utf-8',
    'set-cookie': ['set-cookie1=foo', 'set-cookie2=bar', 'set-cookie3=baz'],
    cookie: 'cookie1=foo; cookie2=bar; cookie3=baz',
    'x-custom': 'custom1, custom2, custom3',
  })
  t.equivalent(rawHeaders, replyHeaders)

  scope.done()
})

test('replyContentLength() sends explicit content-length header with response', async t => {
  const scope = nock('http://example.test')
    .replyContentLength()
    .get('/')
    .reply(200, { hello: 'world' })

  const { headers } = await got('http://example.test/')

  t.equal(headers['content-length'], '17')
  scope.done()
})

test('replyDate() sends explicit date header with response', async t => {
  const date = new Date()

  const scope = nock('http://example.test')
    .replyDate(date)
    .get('/')
    .reply(200, { hello: 'world' })

  const { headers } = await got('http://example.test/')

  t.equal(headers.date, date.toUTCString())
  scope.done()
})

// async / got version is returning "not ok test unfinished".
// https://github.com/nock/nock/issues/1305#issuecomment-451701657
test('replyDate() sends date header with response', t => {
  const clock = lolex.install()
  const date = new Date()

  const scope = nock('http://example.test')
    .replyDate()
    .get('/')
    .reply(200)

  mikealRequest.get('http://example.test', (err, resp) => {
    clock.uninstall()

    if (err) {
      throw err
    }

    t.equal(resp.headers.date, date.toUTCString())
    scope.done()

    t.end()
  })
})
