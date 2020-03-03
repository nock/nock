'use strict'

const { expect } = require('chai')
const http = require('http')
const nock = require('..')

require('./setup')

describe('`res.destroy()`', () => {
  it('should emit error event if called with error', done => {
    nock('http://example.test')
      .get('/')
      .reply(404)

    const respErr = new Error('Response error')

    http
      .get('http://example.test/', res => {
        expect(res.statusCode).to.equal(404)
        res.destroy(respErr)
      })
      .once('error', err => {
        expect(err).to.equal(respErr)
        done()
      })
  })

  it('should not emit error event if called without error', done => {
    nock('http://example.test')
      .get('/')
      .reply(403)

    http
      .get('http://example.test/', res => {
        expect(res.statusCode).to.equal(403)
        res.destroy()
        done()
      })
      .once('error', () => {
        expect.fail('should not emit error')
      })
  })
})
