'use strict'

const test = require('tap').test
const mikealRequest = require('request')

const ssl = require('./ssl')

// Do not copy tests that rely on the process.env.AIRPLANE, we are deprecating that via #1231
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

    const port = server.address().port
    const scope = nock(`https://localhost:${port}`, { allowUnmocked: true })
      .get('/')
      .reply(200, 'mock')

    const options = {
      method: 'GET',
      uri: `https://localhost:${port}`,
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
