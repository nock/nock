'use strict'

// Tests for the body argument passed to `.reply()`.

const { test } = require('tap')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('reply with JSON', async t => {
  const responseBody = { hello: 'world' }
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, responseBody)

  const { statusCode, headers, body } = await got('http://example.test/')

  expect(statusCode).to.equal(200)
  expect(headers).not.to.have.property('date')
  expect(headers).not.to.have.property('content-length')
  expect(headers).to.include({ 'content-type': 'application/json' })
  expect(body)
    .to.be.a('string')
    .and.equal(JSON.stringify(responseBody))
  scope.done()
})

test('reply with JSON array', async t => {
  const responseBody = [{ hello: 'world' }]
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, responseBody)

  const { statusCode, headers, body } = await got('http://example.test/')

  expect(statusCode).to.equal(200)
  expect(headers).not.to.have.property('date')
  expect(headers).not.to.have.property('content-length')
  expect(headers).to.include({ 'content-type': 'application/json' })
  expect(body)
    .to.be.a('string')
    .and.equal(JSON.stringify(responseBody))
  scope.done()
})

test('JSON encoded replies set the content-type header', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, { A: 'b' })

  const { headers } = await got('http://example.test/')

  expect(headers).to.include({ 'content-type': 'application/json' })

  scope.done()
})

test('JSON encoded replies does not overwrite existing content-type header', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, { A: 'b' }, { 'Content-Type': 'unicorns' })

  const { headers } = await got('http://example.test/')

  expect(headers).to.include({ 'content-type': 'unicorns' })

  scope.done()
})

test("blank response doesn't have content-type application/json attached to it", async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const { headers } = await got('http://example.test/')

  expect(headers).not.to.have.property('content-type')

  scope.done()
})

test('unencodable object throws the expected error', t => {
  const unencodableObject = {
    toJSON() {
      throw Error('bad!')
    },
  }

  expect(() =>
    nock('http://localhost')
      .get('/')
      .reply(200, unencodableObject)
  ).to.throw(Error, 'Error encoding response body into JSON')

  t.end()
})

test('reply with missing body defaults to empty', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(204)

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(204)
  expect(body)
    .to.be.a('string')
    .and.equal('')
  scope.done()
})

// while `false` and `null` are falsy, they are valid JSON value so they should be returned as a strings
// that JSON.parse would convert back to native values
test('reply with native boolean as the body', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(204, false)

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(204)
  // `'false'` is json-stringified `false`.
  expect(body)
    .to.be.a('string')
    .and.equal('false')
  scope.done()
})

test('reply with native null as the body', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(204, null)

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(204)
  // `'null'` is json-stringified `null`.
  expect(body)
    .to.be.a('string')
    .and.equal('null')
  scope.done()
})

test('reply with missing status code defaults to 200', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(200)
  expect(body)
    .to.be.a('string')
    .and.equal('')
  scope.done()
})

test('reply with invalid status code throws', t => {
  const scope = nock('http://localhost').get('/')

  expect(() => scope.reply('200')).to.throw(
    Error,
    'Invalid string value for status code'
  )
  expect(() => scope.reply(false)).to.throw(
    Error,
    'Invalid boolean value for status code'
  )

  t.end()
})
