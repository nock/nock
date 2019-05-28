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

test('reply with JSON array', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, [{ hello: 'world' }])

  const { statusCode, headers, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.type(headers.date, 'undefined')
  t.type(headers['content-length'], 'undefined')
  t.equal(headers['content-type'], 'application/json')
  t.equal(body, '[{"hello":"world"}]', 'response should match')
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

// while `false` and `null` are falsy, they are valid JSON value so they should be returned as a strings
// that JSON.parse would convert back to native values
test('reply with native boolean as the body', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(204, false)

  const { statusCode, body } = await got('http://example.test/')

  t.is(statusCode, 204)
  // `'false'` is json-stringified `false`.
  t.equal(body, 'false')
  scope.done()
})

test('reply with native null as the body', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(204, null)

  const { statusCode, body } = await got('http://example.test/')

  t.is(statusCode, 204)
  // `'null'` is json-stringified `null`.
  t.equal(body, 'null')
  scope.done()
})

test('reply with missing status code defaults to 200', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const { statusCode, body } = await got('http://example.test/')

  t.is(statusCode, 200)
  t.equal(body, '')
  scope.done()
})

test('reply with invalid status code throws', t => {
  const scope = nock('http://localhost').get('/')

  t.throws(() => scope.reply('200'), {
    message: 'Invalid string value for status code',
  })
  t.throws(() => scope.reply(false), {
    message: 'Invalid boolean value for status code',
  })

  t.end()
})
