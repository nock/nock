'use strict'

const { expect } = require('chai')
const nock = require('../..')
const got = require('./got_client')

describe('repeating', () => {
  it('`once()`', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .once()
      .reply(200, 'Hello World!')

    const { statusCode } = await got('http://example.test/')
    expect(statusCode).to.equal(200)

    const { statusCode: errorStatus, body } = await got(
      'http://example.test/',
      { responseType: 'json' },
    ).catch(err => err.response)
    expect(errorStatus).to.equal(501)
    expect(body.code).to.equal('ERR_NOCK_NO_MATCH')

    scope.done()
  })

  it('`twice()`', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .twice()
      .reply(200, 'Hello World!')

    // eslint-disable-next-line no-unused-vars
    for (const _ of Array(2)) {
      const { statusCode } = await got('http://example.test/')
      expect(statusCode).to.equal(200)
    }

    const { statusCode, body } = await got('http://example.test/', {
      responseType: 'json',
    }).catch(err => err.response)
    expect(statusCode).to.equal(501)
    expect(body.code).to.equal('ERR_NOCK_NO_MATCH')

    scope.done()
  })

  it('`thrice()`', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .thrice()
      .reply(200, 'Hello World!')

    // eslint-disable-next-line no-unused-vars
    for (const _ of Array(3)) {
      const { statusCode } = await got('http://example.test/')
      expect(statusCode).to.equal(200)
    }

    const { statusCode, body } = await got('http://example.test/', {
      responseType: 'json',
    }).catch(err => err.response)
    expect(statusCode).to.equal(501)
    expect(body.code).to.equal('ERR_NOCK_NO_MATCH')

    scope.done()
  })

  describe('`times()`', () => {
    it('repeating 4 times', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .times(4)
        .reply(200, 'Hello World!')

      // eslint-disable-next-line no-unused-vars
      for (const _ of Array(4)) {
        const { statusCode } = await got('http://example.test/')
        expect(statusCode).to.equal(200)
      }

      const { statusCode: errorStatus, body } = await got(
        'http://example.test/',
        { responseType: 'json' },
      ).catch(err => err.response)
      expect(errorStatus).to.equal(501)
      expect(body.code).to.equal('ERR_NOCK_NO_MATCH')

      scope.done()
    })

    it('invalid argument is ignored', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .times(0)
        .reply(200, 'Hello World!')

      const { statusCode } = await got('http://example.test/')
      expect(statusCode).to.equal(200)

      const { statusCode: errorStatus, body } = await got(
        'http://example.test/',
        { responseType: 'json' },
      ).catch(err => err.response)
      expect(errorStatus).to.equal(501)
      expect(body.code).to.equal('ERR_NOCK_NO_MATCH')

      scope.done()
    })
  })

  it('`isDone()` considers repeated responses', async () => {
    const scope = nock('http://example.test').get('/').times(2).reply(204)

    // eslint-disable-next-line no-unused-vars
    for (const _ of Array(2)) {
      expect(scope.isDone()).to.be.false()
      await got('http://example.test/')
    }
    expect(scope.isDone()).to.be.true()
  })
})
