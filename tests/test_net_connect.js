'use strict'

const http = require('http')
const { test } = require('tap')
const { expect } = require('chai')
const assertRejects = require('assert-rejects')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

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
    expect(err).to.include({
      code: 'ENETUNREACH',
      message: 'Nock: Disallowed net connect for "example.test:80/"',
    })
    expect(err.stack).to.be.a('string')
    return true
  })
})

test('enable real HTTP request only for specified domain, via string', async t => {
  const onResponse = sinon.spy()
  const server = http.createServer((request, response) => {
    onResponse()
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))

  nock.enableNetConnect('localhost')

  await got(`http://localhost:${server.address().port}/`)
  expect(onResponse).to.have.been.calledOnce()
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
  const onResponse = sinon.spy()
  const server = http.createServer((request, response) => {
    onResponse()
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))

  nock.enableNetConnect(/ocalhos/)

  await got(`http://localhost:${server.address().port}/`)
  expect(onResponse).to.have.been.calledOnce()
})

test('disallow request for other domains, via regexp', async t => {
  nock.enableNetConnect(/ocalhos/)

  await assertRejects(
    got('https://example.test/'),
    Error,
    'Nock: Disallowed net connect for "example.test:80/"'
  )
})
