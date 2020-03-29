'use strict'

const http = require('http')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')

require('./setup')

describe('`socketDelay()`', () => {
  it('socketDelay', done => {
    nock('http://example.test')
      .get('/')
      .socketDelay(200)
      .reply(200, '<html></html>')

    const req = http.get('http://example.test')

    const onTimeout = sinon.spy()

    req.on('socket', socket => {
      if (!socket.connecting) {
        req.setTimeout(100, onTimeout)
        return
      }

      socket.on('connect', () => {
        req.setTimeout(100, onTimeout)
      })
    })

    req.on('response', () => {
      expect(onTimeout).to.have.been.calledOnce()
      done()
    })
  })

  it('emits a timeout - with setTimeout', done => {
    nock('http://example.test').get('/').socketDelay(10000).reply(200, 'OK')

    const onEnd = sinon.spy()

    const req = http.request('http://example.test', res => {
      res.setEncoding('utf8')
      res.once('end', onEnd)
    })

    req.setTimeout(5000, () => {
      expect(onEnd).not.to.have.been.called()
      done()
    })

    req.end()
  })

  it('emits a timeout - with options.timeout', done => {
    nock('http://example.test').get('/').socketDelay(10000).reply(200, 'OK')

    const onEnd = sinon.spy()

    const req = http.request('http://example.test', { timeout: 5000 }, res => {
      res.setEncoding('utf8')
      res.once('end', onEnd)
    })

    req.on('timeout', function () {
      expect(onEnd).not.to.have.been.called()
      done()
    })

    req.end()
  })

  it('does not emit a timeout when timeout > socketDelay', done => {
    const responseText = 'okeydoke!'
    const scope = nock('http://example.test')
      .get('/')
      .socketDelay(10000)
      .reply(200, responseText)

    const req = http.request('http://example.test', res => {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', chunk => {
        body += chunk
      })

      res.once('end', () => {
        expect(body).to.equal(responseText)
        done()
      })
    })

    req.setTimeout(60000, () => {
      expect.fail('socket timed out unexpectedly')
    })

    req.end()
    scope.done()
  })
})

describe('`Socket#setTimeout()`', () => {
  it('adds callback as a one-time listener for parity with a real socket', done => {
    nock('http://example.test')
      .get('/')
      .socketDelay(100)
      .reply(200, '<html></html>')

    const onTimeout = () => {
      done()
    }

    http.get('http://example.test').on('socket', socket => {
      socket.setTimeout(50, onTimeout)
    })
  })

  it('can be called without a callback', done => {
    nock('http://example.test').get('/').socketDelay(100).reply()

    http.get('http://example.test').on('socket', socket => {
      socket.setTimeout(50)

      socket.on('timeout', () => {
        done()
      })
    })
  })
})
