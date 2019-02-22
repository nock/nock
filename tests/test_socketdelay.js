'use strict'

const { test } = require('tap')
const http = require('http')
const nock = require('..')

require('./cleanup_hook')()

test('socketDelay', function(t) {
  let timeouted = false

  nock('http://example.test')
    .get('/')
    .socketDelay(200)
    .reply(200, '<html></html>')

  const req = http.get('http://example.test')

  const onTimeout = () => {
    timeouted = true
  }

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
    t.ok(timeouted)
    t.end()
  })
})

test('calling socketDelay will emit a timeout', t => {
  nock('http://example.test')
    .get('/')
    .socketDelay(10000)
    .reply(200, 'OK')

  let timedout = false
  let ended = false

  const req = http.request('http://example.test', function(res) {
    res.setEncoding('utf8')

    res.once('end', function() {
      ended = true
      if (!timedout) {
        t.fail('socket did not timeout when idle')
        t.end()
      }
    })
  })

  req.setTimeout(5000, function() {
    timedout = true
    if (!ended) {
      t.ok(true)
      t.end()
    }
  })

  req.end()
})

test('calling socketDelay not emit a timeout if not idle for long enough', t => {
  nock('http://example.test')
    .get('/')
    .socketDelay(10000)
    .reply(200, 'OK')

  const req = http.request('http://example.test', function(res) {
    res.setEncoding('utf8')

    let body = ''

    res.on('data', function(chunk) {
      body += chunk
    })

    res.once('end', function() {
      t.equal(body, 'OK')
      t.end()
    })
  })

  req.setTimeout(60000, function() {
    t.fail('socket timed out unexpectedly')
    t.end()
  })

  req.end()
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
