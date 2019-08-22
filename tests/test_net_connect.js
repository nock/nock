'use strict'

const http = require('http')
const { test } = require('tap')
const assertRejects = require('assert-rejects')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('disable net connect is default', async t => {
  nock.disableNetConnect()

  nock('http://www.example.test')
    .get('/')
    .reply(200)

  await assertRejects(
    got('https://other.example.test/'),
    Error,
    'Nock: Disallowed net connect for "other.example.test:443/"'
  )
})

test('when net connect is disabled, throws the expected error ', async t => {
  nock.disableNetConnect()

  await assertRejects(got('http://example.test'), Error, err => {
    t.equal(err.message, 'Nock: Disallowed net connect for "example.test:80/"')
    t.equal(err.code, 'ENETUNREACH')
    t.ok(err.stack)
  })
})

test('enable real HTTP request only for specified domain, via string', async t => {
  t.plan(1)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))

  nock.enableNetConnect('localhost')

  await got(`http://localhost:${server.address().port}/`)
})

test('disallow request for other domains, via string', async t => {
  nock.enableNetConnect('localhost')

  await assertRejects(
    got('https://example.test/'),
    Error,
    'Nock: Disallowed net connect for "example.test:80/"'
  )
})

test('enable real HTTP request only for specified domain, via regexp', async t => {
  t.plan(1)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))

  nock.enableNetConnect(/ocalhos/)

  await got(`http://localhost:${server.address().port}/`)
})

test('disallow request for other domains, via regexp', async t => {
  nock.enableNetConnect(/ocalhos/)

  await assertRejects(
    got('https://example.test/'),
    Error,
    'Nock: Disallowed net connect for "example.test:80/"'
  )
})
