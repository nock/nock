'use strict'

// Tests for the body argument passed to `.reply()`.

const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

describe('`reply()` body', () => {
  it('stringifies an object', async () => {
    const responseBody = { hello: 'world' }
    const scope = nock('http://example.test').get('/').reply(200, responseBody)

    const { statusCode, headers, body } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    expect(headers).not.to.have.property('date')
    expect(headers).not.to.have.property('content-length')
    expect(headers).to.include({ 'content-type': 'application/json' })
    expect(body).to.be.a('string').and.equal(JSON.stringify(responseBody))
    scope.done()
  })

  it('stringifies an array', async () => {
    const responseBody = [{ hello: 'world' }]
    const scope = nock('http://example.test').get('/').reply(200, responseBody)

    const { statusCode, headers, body } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    expect(headers).not.to.have.property('date')
    expect(headers).not.to.have.property('content-length')
    expect(headers).to.include({ 'content-type': 'application/json' })
    expect(body).to.be.a('string').and.equal(JSON.stringify(responseBody))
    scope.done()
  })

  // While `false` and `null` are falsy, they are valid JSON value so they
  // should be returned as strings that `JSON.parse()` would convert back to
  // native values.
  it('stringifies a boolean (including `false`)', async () => {
    const scope = nock('http://example.test').get('/').reply(204, false)

    const { statusCode, body } = await got('http://example.test/')

    expect(statusCode).to.equal(204)
    // `'false'` is json-stringified `false`.
    expect(body).to.be.a('string').and.equal('false')
    scope.done()
  })

  it('stringifies null', async () => {
    const scope = nock('http://example.test').get('/').reply(204, null)

    const { statusCode, body } = await got('http://example.test/')

    expect(statusCode).to.equal(204)
    // `'null'` is json-stringified `null`.
    expect(body).to.be.a('string').and.equal('null')
    scope.done()
  })

  describe('content-type header', () => {
    it('is set for a JSON-encoded response', async () => {
      const scope = nock('http://example.test').get('/').reply(200, { A: 'b' })

      const { headers } = await got('http://example.test/')

      expect(headers).to.include({ 'content-type': 'application/json' })

      scope.done()
    })

    it("doesn't overwrite existing content-type header", async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(200, { A: 'b' }, { 'Content-Type': 'unicorns' })

      const { headers } = await got('http://example.test/')

      expect(headers).to.include({ 'content-type': 'unicorns' })

      scope.done()
    })

    it("isn't set for a blank response", async () => {
      const scope = nock('http://example.test').get('/').reply()

      const { headers } = await got('http://example.test/')

      expect(headers).not.to.have.property('content-type')

      scope.done()
    })
  })

  it('unencodable object throws the expected error', () => {
    const unencodableObject = {
      toJSON() {
        throw Error('bad!')
      },
    }

    expect(() =>
      nock('http://localhost').get('/').reply(200, unencodableObject)
    ).to.throw(Error, 'Error encoding response body into JSON')
  })

  it('without a body, defaults to empty', async () => {
    const scope = nock('http://example.test').get('/').reply(204)

    const { statusCode, body } = await got('http://example.test/')

    expect(statusCode).to.equal(204)
    expect(body).to.be.a('string').and.equal('')
    scope.done()
  })
})

describe('`reply()` status code', () => {
  it('reply with missing status code defaults to 200', async () => {
    const scope = nock('http://example.test').get('/').reply()

    const { statusCode, body } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    expect(body).to.be.a('string').and.equal('')
    scope.done()
  })

  it('reply with invalid status code throws', () => {
    const scope = nock('http://localhost').get('/')

    expect(() => scope.reply('200')).to.throw(
      Error,
      'Invalid string value for status code'
    )
    expect(() => scope.reply(false)).to.throw(
      Error,
      'Invalid boolean value for status code'
    )
  })
})
