'use strict'

const assert = require('assert')
const http = require('http')
const got = require('got')
const mikealRequest = require('request')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_hook')()

test('disable net connect is default', function(t) {
  nock.disableNetConnect()

  nock('http://example.test')
    .get('/')
    .reply(200)

  mikealRequest('https://google.com/', function(err, res) {
    assert(err)
    assert.equal(
      err.message,
      'Nock: Disallowed net connect for "google.com:443/"'
    )
    t.end()
  })
})

test('when net connect is disabled, throws the expected error ', async t => {
  nock.disableNetConnect()

  try {
    await got('http://example.test')
    t.fail('Expected to throw')
  } catch (err) {
    t.type(err, 'Error')
    t.equal(err.message, 'Nock: Disallowed net connect for "example.test:80/"')
    t.equal(err.code, 'ENETUNREACH')
    t.ok(err.stack)
  }
})

test('enable real HTTP request only for specified domain, via string', t => {
  t.plan(1)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
    t.end()
  })
  t.once('end', () => server.close())

  nock.enableNetConnect('localhost')

  server.listen(() =>
    mikealRequest(`http://localhost:${server.address().port}/`)
  )
})

test('disallow request for other domains, via string', t => {
  nock.enableNetConnect('localhost')

  http
    .get('http://www.amazon.com', function(res) {
      throw 'should not deliver this request'
    })
    .on('error', function(err) {
      t.equal(
        err.message,
        'Nock: Disallowed net connect for "www.amazon.com:80/"'
      )
      t.end()
    })
})

test('enable real HTTP request only for specified domain, via regexp', t => {
  t.plan(1)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
    t.end()
  })
  t.once('end', () => server.close())

  nock.enableNetConnect(/ocalhos/)

  server.listen(() =>
    mikealRequest(`http://localhost:${server.address().port}/`)
  )
})

test('disallow request for other domains, via regexp', t => {
  nock.enableNetConnect(/ocalhos/)

  http
    .get('http://www.amazon.com', function(res) {
      throw 'should not deliver this request'
    })
    .on('error', function(err) {
      t.equal(
        err.message,
        'Nock: Disallowed net connect for "www.amazon.com:80/"'
      )
      t.end()
    })
})
