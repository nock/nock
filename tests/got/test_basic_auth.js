'use strict'

const { expect } = require('chai')
const nock = require('../..')
const got = require('./got_client')

describe('basic auth with username and password', () => {
  beforeEach(done => {
    nock('http://example.test')
      .get('/test')
      .basicAuth({ user: 'foo', pass: 'bar' })
      .reply(200, 'Here is the content')
    done()
  })

  it('succeeds when it matches', async () => {
    const response = await got('http://example.test/test', {
      username: 'foo',
      password: 'bar',
    })
    expect(response.statusCode).to.equal(200)
    expect(response.body).to.equal('Here is the content')
  })

  it('fails when it doesnt match', async () => {
    const { statusCode, body } = await got('http://example.test/test', { responseType: 'json'})
      .catch(err => err.response)
    expect(statusCode).to.equal(501)
    expect(body.code).to.equal('ERR_NOCK_NO_MATCH')
  })
})

describe('basic auth with username only', () => {
  beforeEach(done => {
    nock('http://example.test')
      .get('/test')
      .basicAuth({ user: 'foo' })
      .reply(200, 'Here is the content')
    done()
  })

  it('succeeds when it matches', async () => {
    const response = await got('http://example.test/test', {
      username: 'foo',
      password: '',
    })
    expect(response.statusCode).to.equal(200)
    expect(response.body).to.equal('Here is the content')
  })

  it('fails when it doesnt match', async () => {
    const { statusCode, body } = await got('http://example.test/test', { responseType: 'json'})
      .catch(err => err.response)
    expect(statusCode).to.equal(501)
    expect(body.code).to.equal('ERR_NOCK_NO_MATCH')
  })
})
