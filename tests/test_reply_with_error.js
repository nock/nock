'use strict'

// Tests for `.replyWithError()`.

const http = require('http')
const { expect } = require('chai')
const nock = require('..')

describe('`replyWithError()`', () => {
  it('returns an error through the request', done => {
    const scope = nock('http://example.test')
      .post('/echo')
      .replyWithError('Service not found')

    const req = http.request({
      host: 'example.test',
      method: 'POST',
      path: '/echo',
      port: 80,
    })

    req.on('error', e => {
      expect(e)
        .to.be.an.instanceof(Error)
        .and.include({ message: 'Service not found' })
      scope.done()
      done()
    })

    req.end()
  })

  // TODO: https://github.com/mswjs/interceptors/issues/625
  it.skip('allows an Error response', done => {
    const scope = nock('http://example.test')
      .post('/echo')
      .replyWithError(
        Object.assign(new Error('Connection refused'), {
          code: 'ECONNREFUSED',
        }),
      )

    const req = http.request({
      host: 'example.test',
      method: 'POST',
      path: '/echo',
      port: 80,
    })

    req.on('error', e => {
      expect(e).to.deep.equal({
        message: 'Connection refused',
        code: 'ECONNREFUSED',
      })
      scope.done()
      done()
    })

    req.end()
  })
})
