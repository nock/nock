'use strict'

// Tests for the body argument passed to `.reply()`.

const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('reply with JSON', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, { hello: 'world' })

  const { statusCode, headers, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.type(headers.date, 'undefined')
  t.type(headers['content-length'], 'undefined')
  t.equal(headers['content-type'], 'application/json')
  t.equal(body, '{"hello":"world"}', 'response should match')
  scope.done()
})

test('JSON encoded replies set the content-type header', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, {
      A: 'b',
    })

  t.equal(
    (await got('http://example.test/')).headers['content-type'],
    'application/json'
  )

  scope.done()
})

test('JSON encoded replies does not overwrite existing content-type header', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(
      200,
      {
        A: 'b',
      },
      {
        'Content-Type': 'unicorns',
      }
    )

  t.equal(
    (await got('http://example.test/')).headers['content-type'],
    'unicorns'
  )

  scope.done()
})

test("blank response doesn't have content-type application/json attached to it", async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200)

  t.equal(
    (await got('http://example.test/')).headers['content-type'],
    undefined
  )

  scope.done()
})

test('unencodable object throws the expected error', t => {
  const unencodableObject = {
    toJSON() {
      throw Error('bad!')
    },
  }

  t.throws(
    () =>
      nock('http://localhost')
        .get('/')
        .reply(200, unencodableObject),
    {
      message: 'Error encoding response body into JSON',
    }
  )

  t.end()
})

test('reply with missing body defaults to empty', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(204)

  const { statusCode, body } = await got('http://example.test/')

  t.is(statusCode, 204)
  t.equal(body, '')
  scope.done()
})

test('reply with missing status code defaults to 200 + empty body', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const { statusCode, body } = await got('http://example.test/')

  t.is(statusCode, 200)
  t.equal(body, '')
  scope.done()
})
