'use strict'

const { expect } = require('chai')
const assertRejects = require('assert-rejects')
const nock = require('..')
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
    await assertRejects(
      got('http://example.test/test'),
      /Nock: No match for request/
    )
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
    await assertRejects(
      got('http://example.test/test'),
      /Nock: No match for request/
    )
  })
})
