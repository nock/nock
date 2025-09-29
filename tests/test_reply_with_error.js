'use strict'

// Tests for `.replyWithError()`.

const http = require('node:http')
const { expect } = require('chai')
const nock = require('..')

describe('`replyWithError()`', () => {
  it('returns a string as an error response through the request', done => {
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

  it('returns an Error object as an error response through the request', done => {
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
      expect(e).to.be.an.instanceof(Error)
      expect(e).to.have.property('message', 'Connection refused')
      expect(e).to.have.property('code', 'ECONNREFUSED')
      scope.done()
      done()
    })

    req.end()
  })
})
