'use strict'

const { test } = require('tap')
const http = require('http')
const nock = require('../.')

test('socketDelay', function(t) {
  let timeouted = false

  nock('http://my.server.com')
    .get('/')
    .socketDelay(200)
    .reply(200, '<html></html>')

  const req = http.get('http://my.server.com')

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
