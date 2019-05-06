'use strict'

// Tests for header objects passed to `.reply()`, including header objects
// containing lambdas.

const { test } = require('tap')
const mikealRequest = require('request')
const lolex = require('lolex')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('headers work', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'Hello World!', { 'X-My-Headers': 'My Header value' })

  const { headers } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'My Header value' })
  scope.done()
})

test('reply headers as function work', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => body.toString(),
    })

  const { headers, rawHeaders } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'boo!' })
  t.equivalent(rawHeaders, ['X-My-Headers', 'boo!'])
  scope.done()
})

// Skipping these two test because of the inconsistencies around raw headers.
// - they often receive the lower-cased versions of the keys
// - the resulting order differs depending if overrides are provided to .reply directly or via a callback
// - replacing values with function results isn't guaranteed to keep the correct order
// - the resulting `headers` object itself is fine and these assertions pass
test('reply headers and defaults', { skip: true }, async t => {
  const scope = nock('http://example.com')
    .defaultReplyHeaders({
      'X-Powered-By': 'Meeee',
      'X-Another-Header': 'Hey man!',
    })
    .get('/')
    .reply(200, 'Success!', {
      'X-Custom-Header': 'boo!',
      'x-another-header': 'foobar',
    })

  const { headers, rawHeaders } = await got('http://example.com/')

  t.equivalent(headers, {
    'x-custom-header': 'boo!',
    'x-another-header': 'foobar', // note this overrode the default value, despite the case difference
    'x-powered-by': 'Meeee',
  })
  t.equivalent(rawHeaders, [
    'X-Powered-By',
    'Meeee',
    'X-Another-Header',
    'Hey man!',
    'X-Custom-Header',
    'boo!',
    'x-another-header',
    'foobar',
  ])
  scope.done()
})

test('reply headers from callback and defaults', { skip: true }, async t => {
  const scope = nock('http://example.com')
    .defaultReplyHeaders({
      'X-Powered-By': 'Meeee',
      'X-Another-Header': 'Hey man!',
    })
    .get('/')
    .reply(() => [
      200,
      'Success!',
      { 'X-Custom-Header': 'boo!', 'x-another-header': 'foobar' },
    ])

  const { headers, rawHeaders } = await got('http://example.com/')

  t.equivalent(headers, {
    'x-custom-header': 'boo!',
    'x-another-header': 'foobar',
    'x-powered-by': 'Meeee',
  })
  t.equivalent(rawHeaders, [
    'X-Powered-By',
    'Meeee',
    'X-Another-Header',
    'Hey man!',
    'X-Custom-Header',
    'boo!',
    'x-another-header',
    'foobar',
  ])
  scope.done()
})

test('reply headers as function are evaluated only once per request', async t => {
  let counter = 0
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => {
        ++counter
        return body.toString()
      },
    })

  const { headers, rawHeaders } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'boo!' })
  t.equivalent(rawHeaders, ['X-My-Headers', 'boo!'])
  scope.done()

  t.equal(counter, 1)
})

test('reply headers as function are evaluated on each request', async t => {
  let counter = 0
  const scope = nock('http://example.com')
    .get('/')
    .times(2)
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => `${++counter}`,
    })

  const { headers, rawHeaders } = await got('http://example.com/')
  t.equivalent(headers, { 'x-my-headers': '1' })
  t.equivalent(rawHeaders, ['X-My-Headers', '1'])

  t.equal(counter, 1)

  const { headers: headers2, rawHeaders: rawHeaders2 } = await got(
    'http://example.com/'
  )
  t.equivalent(headers2, { 'x-my-headers': '2' })
  t.equivalent(rawHeaders2, ['X-My-Headers', '2'])

  t.equal(counter, 2)

  scope.done()
})

test('reply with content-length header', async t => {
  const scope = nock('http://example.test')
    .replyContentLength()
    .get('/')
    .reply(200, { hello: 'world' })

  const { headers } = await got('http://example.test/')

  t.equal(headers['content-length'], 17)
  scope.done()
})

test('reply with explicit date header', async t => {
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
test('reply with implicit date header', t => {
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
