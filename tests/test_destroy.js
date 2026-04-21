import { expect } from 'chai'
import http from 'node:http'
import nock from '../index.ts'

describe('`res.destroy()`', () => {
  it('should emit error event if called with error', done => {
    nock('http://example.test').get('/').reply(404)

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
    nock('http://example.test').get('/').reply(403)

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

  it('should not emit an response if destroyed first', done => {
    nock('http://example.test').get('/').reply()

    const req = http
      .get('http://example.test/', () => {
        expect.fail('should not emit a response')
      })
      .on('error', () => {}) // listen for error so "socket hang up" doesn't bubble
      .on('socket', () => {
        setImmediate(() => req.destroy())
      })

    // give the `setImmediate` calls enough time to cycle.
    setTimeout(() => done(), 10)
  })
})
