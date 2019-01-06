'use strict'

const { test } = require('tap')
const mikealRequest = require('request')

const ssl = require('./ssl')

test('NOCK_OFF=true works for https', function(t) {
  const original = process.env.NOCK_OFF
  process.env.NOCK_OFF = 'true'
  const nock = require('../')

  t.plan(4)

  function middleware(request, response) {
    t.pass('server received a request')
    response.writeHead(200)
    response.end('the real thing')
  }

  ssl.startServer(middleware, function(error, server) {
    t.error(error)

    const url = `https://localhost:${server.address().port}`
    const scope = nock(url, { allowUnmocked: true })
      .get('/')
      .reply(200, 'mock')

    const options = {
      method: 'GET',
      uri: url,
      ca: ssl.ca,
    }

    mikealRequest(options, function(err, resp, body) {
      t.error(err)
      t.equal(body, 'the real thing')
      scope.done()
      process.env.NOCK_OFF = original
      server.close(t.end)
    })
  })
})
