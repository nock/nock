'use strict'

const http = require('http')
const nock = require('..')

require('./setup')

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
