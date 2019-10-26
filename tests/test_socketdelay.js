'use strict'

const http = require('http')
const { test } = require('tap')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')

require('./cleanup_after_each')()

test('socketDelay', t => {
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
    t.end()
  })
})

test('calling socketDelay will emit a timeout', t => {
  nock('http://example.test')
    .get('/')
    .socketDelay(10000)
    .reply(200, 'OK')

  const onEnd = sinon.spy()

  const req = http.request('http://example.test', res => {
    res.setEncoding('utf8')
    res.once('end', onEnd)
  })

  req.setTimeout(5000, () => {
    expect(onEnd).not.to.have.been.called()
    t.end()
  })

  req.end()
})

test('calling socketDelay not emit a timeout if not idle for long enough', t => {
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
      t.end()
    })
  })

  req.setTimeout(60000, () => {
    expect.fail('socket timed out unexpectedly')
    t.end()
  })

  req.end()
  scope.done()
})

test('Socket#setTimeout adds callback as a one-time listener for parity with a real socket', t => {
  nock('http://example.test')
    .get('/')
    .socketDelay(100)
    .reply(200, '<html></html>')

  const onTimeout = () => {
    t.end()
  }

  http.get('http://example.test').on('socket', socket => {
    socket.setTimeout(50, onTimeout)
  })
})

test('Socket#setTimeout can be called without a callback', t => {
  nock('http://example.test')
    .get('/')
    .socketDelay(100)
    .reply()

  http.get('http://example.test').on('socket', socket => {
    socket.setTimeout(50)

    socket.on('timeout', () => {
      t.end()
    })
  })
})
