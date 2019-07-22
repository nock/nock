'use strict'

// Tests of `.defaultReplyHeaders()`.

const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('when no headers are specified on the request, default reply headers work', async t => {
  nock('http://example.test')
    .defaultReplyHeaders({
      'X-Powered-By': 'Meeee',
      'X-Another-Header': ['foo', 'bar'],
    })
    .get('/')
    .reply(200, '')

  const { headers, rawHeaders } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-powered-by': 'Meeee',
    'x-another-header': 'foo, bar',
  })

  t.deepEqual(rawHeaders, [
    'X-Powered-By',
    'Meeee',
    'X-Another-Header',
    ['foo', 'bar'],
  ])
})

test('default reply headers can be provided as a raw array', async t => {
  const defaultHeaders = [
    'X-Powered-By',
    'Meeee',
    'X-Another-Header',
    ['foo', 'bar'],
  ]
  nock('http://example.test')
    .defaultReplyHeaders(defaultHeaders)
    .get('/')
    .reply(200, '')

  const { headers, rawHeaders } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-powered-by': 'Meeee',
    'x-another-header': 'foo, bar',
  })

  t.deepEqual(rawHeaders, defaultHeaders)
})

test('default reply headers can be provided as a Map', async t => {
  const defaultHeaders = new Map([
    ['X-Powered-By', 'Meeee'],
    ['X-Another-Header', ['foo', 'bar']],
  ])
  nock('http://example.test')
    .defaultReplyHeaders(defaultHeaders)
    .get('/')
    .reply(200, '')

  const { headers, rawHeaders } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-powered-by': 'Meeee',
    'x-another-header': 'foo, bar',
  })

  t.deepEqual(rawHeaders, [
    'X-Powered-By',
    'Meeee',
    'X-Another-Header',
    ['foo', 'bar'],
  ])
})

test('when headers are specified on the request, they override default reply headers', async t => {
  nock('http://example.test')
    .defaultReplyHeaders({
      'X-Powered-By': 'Meeee',
      'X-Another-Header': 'Hey man!',
    })
    .get('/')
    .reply(200, '', { A: 'b' })

  const { headers } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-powered-by': 'Meeee',
    'x-another-header': 'Hey man!',
    a: 'b',
  })
})

test('default reply headers as functions work', async t => {
  const date = new Date().toUTCString()
  const message = 'A message.'

  nock('http://example.test')
    .defaultReplyHeaders({
      'Content-Length': (req, res, body) => body.length,
      Date: () => date,
      Foo: () => 'foo',
    })
    .get('/')
    .reply(200, message, { foo: 'bar' })

  const { headers } = await got('http://example.test')

  t.deepEqual(headers, {
    'content-length': message.length,
    date,
    foo: 'bar',
  })
})

test('reply should not cause an error on header conflict', async t => {
  const scope = nock('http://example.test').defaultReplyHeaders({
    'content-type': 'application/json',
  })

  scope.get('/').reply(200, '<html></html>', {
    'Content-Type': 'application/xml',
  })

  const { statusCode, headers, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.equal(headers['content-type'], 'application/xml')
  t.equal(body, '<html></html>')
})

test('direct reply headers override defaults when casing differs', async t => {
  const scope = nock('http://example.test')
    .defaultReplyHeaders({
      'X-Default-Only': 'default',
      'X-Overridden': 'default',
    })
    .get('/')
    .reply(200, 'Success!', {
      'X-Reply-Only': 'from-reply',
      'x-overridden': 'from-reply',
    })

  const { headers, rawHeaders } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-default-only': 'default',
    'x-reply-only': 'from-reply',
    'x-overridden': 'from-reply', // note this overrode the default value, despite the case difference
  })
  t.deepEqual(rawHeaders, [
    'X-Reply-Only',
    'from-reply',
    'x-overridden',
    'from-reply',
    'X-Default-Only',
    'default',
    // note 'X-Overridden' from the defaults is not included
  ])
  scope.done()
})

test('dynamic reply headers override defaults when casing differs', async t => {
  const scope = nock('http://example.test')
    .defaultReplyHeaders({
      'X-Default-Only': 'default',
      'X-Overridden': 'default',
    })
    .get('/')
    .reply(() => [
      200,
      'Success!',
      {
        'X-Reply-Only': 'from-reply',
        'x-overridden': 'from-reply',
      },
    ])

  const { headers, rawHeaders } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-default-only': 'default',
    'x-reply-only': 'from-reply',
    'x-overridden': 'from-reply',
  })
  t.deepEqual(rawHeaders, [
    'X-Reply-Only',
    'from-reply',
    'x-overridden',
    'from-reply',
    'X-Default-Only',
    'default',
  ])
  scope.done()
})
