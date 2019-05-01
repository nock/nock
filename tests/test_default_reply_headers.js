'use strict'

// Tests of `.defaultReplyHeaders()`.

const { test } = require('tap')
const nock = require('..')
const got = require('got')

require('./cleanup_after_each')()

test('when no headers are specified on the request, default reply headers work', async t => {
  nock('http://example.test')
    .defaultReplyHeaders({
      'X-Powered-By': 'Meeee',
      'X-Another-Header': 'Hey man!',
    })
    .get('/')
    .reply(200, '')

  const { headers } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-powered-by': 'Meeee',
    'x-another-header': 'Hey man!',
  })
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
