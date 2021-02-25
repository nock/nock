'use strict'

const { expect } = require('chai')
const http = require('http')
const https = require('https')
const nock = require('..')

require('./setup')

it('should expose TLSSocket attributes for HTTPS requests', done => {
  nock('https://example.test').get('/').reply()

  https.get('https://example.test').on('socket', socket => {
    expect(socket.authorized).to.equal(true)
    expect(socket.encrypted).to.equal(true)
    done()
  })
})

it('should not have TLSSocket attributes for HTTP requests', done => {
  nock('http://example.test').get('/').reply()

  http.get('http://example.test').on('socket', socket => {
    expect(socket.authorized).to.equal(undefined)
    expect(socket.encrypted).to.equal(undefined)
    done()
  })
})

describe('`Socket#setTimeout()`', () => {
  it('adds callback as a one-time listener for parity with a real socket', done => {
    nock('http://example.test').get('/').delayConnection(100).reply()

    const onTimeout = () => {
      done()
    }

    http.get('http://example.test').on('socket', socket => {
      socket.setTimeout(50, onTimeout)
    })
  })

  it('can be called without a callback', done => {
    nock('http://example.test').get('/').delayConnection(100).reply()

    http.get('http://example.test').on('socket', socket => {
      socket.setTimeout(50)

      socket.on('timeout', () => {
        done()
      })
    })
  })
})
