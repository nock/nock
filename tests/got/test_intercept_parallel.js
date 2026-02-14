'use strict'

const { expect } = require('chai')
const nock = require('../..')
const got = require('./got_client')

// Tests for a regression where multiple ClientRequests call `.end` during the
// same event loop iteration. https://github.com/nock/nock/issues/1937

describe('interception in parallel', () => {
  const origin = 'https://example.test'
  const makeRequest = () =>
    got(origin, { responseType: 'json' })
      .then(res => res.statusCode)
      .catch(reason => {
        if (reason.response.body.code === 'ERR_NOCK_NO_MATCH') return 501
        throw reason
      })

  it('consumes multiple requests, using multiple Interceptors on the same Scope', async () => {
    const scope = nock(origin)

    scope.get('/').reply(200)
    scope.get('/').reply(201)

    const results = await Promise.all([
      makeRequest(),
      makeRequest(),
      makeRequest(),
    ])

    expect(results.sort()).to.deep.equal([200, 201, 501])
    scope.done()
  })

  it('consumes multiple requests, using a single Interceptor', async () => {
    const scope = nock(origin).get('/').times(2).reply(200)

    const results = await Promise.all([
      makeRequest(),
      makeRequest(),
      makeRequest(),
    ])

    expect(results.sort()).to.deep.equal([200, 200, 501])
    scope.done()
  })

  it('consumes multiple requests, using multiple Scopes', async () => {
    nock(origin).get('/').reply(200)
    nock(origin).get('/').reply(201)

    const results = await Promise.all([
      makeRequest(),
      makeRequest(),
      makeRequest(),
    ])

    expect(results.sort()).to.deep.equal([200, 201, 501])
    expect(nock.isDone()).to.equal(true)
  })
})
