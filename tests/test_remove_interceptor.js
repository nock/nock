'use strict'

const { test } = require('tap')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('remove interceptor for GET resource', async t => {
  nock('http://example.test')
    .get('/somepath')
    .reply(200, 'hey')

  expect(
    nock.removeInterceptor({
      hostname: 'example.test',
      path: '/somepath',
    })
  ).to.be.true()

  const newScope = nock('http://example.test')
    .get('/somepath')
    .reply(202, 'other-content')

  const { statusCode, body } = await got('http://example.test/somepath')

  expect(statusCode).to.equal(202)
  expect(body).to.equal('other-content')

  newScope.done()
})

test('remove interceptor removes given interceptor', async t => {
  const givenInterceptor = nock('http://example.test').get('/somepath')
  givenInterceptor.reply(200, 'hey')

  expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

  const newScope = nock('http://example.test')
    .get('/somepath')
    .reply(202, 'other-content')

  const { statusCode, body } = await got('http://example.test/somepath')

  expect(statusCode).to.equal(202)
  expect(body).to.equal('other-content')

  newScope.done()
})

test('remove interceptor removes interceptor from pending requests', t => {
  const givenInterceptor = nock('http://example.test').get('/somepath')
  const scope = givenInterceptor.reply(200, 'hey')

  expect(scope.pendingMocks()).to.deep.equal([
    'GET http://example.test:80/somepath',
  ])

  expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

  expect(scope.pendingMocks()).to.deep.equal([])

  t.end()
})

test('remove interceptor removes given interceptor for https', async t => {
  const givenInterceptor = nock('https://example.test').get('/somepath')
  const scope = givenInterceptor.reply(200, 'hey')

  expect(scope.pendingMocks()).to.deep.equal([
    'GET https://example.test:443/somepath',
  ])

  expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

  const newScope = nock('https://example.test')
    .get('/somepath')
    .reply(202, 'other-content')

  const { statusCode, body } = await got('https://example.test/somepath')

  expect(statusCode).to.equal(202)
  expect(body).to.equal('other-content')

  newScope.done()
})

test('remove interceptor removes given interceptor for regex path', async t => {
  const givenInterceptor = nock('http://example.test').get(/somePath$/)
  const scope = givenInterceptor.reply(200, 'hey')

  expect(scope.pendingMocks()).to.deep.equal([
    'GET http://example.test:80//somePath$/',
  ])

  expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

  const newScope = nock('http://example.test')
    .get(/somePath$/)
    .reply(202, 'other-content')

  const { statusCode, body } = await got('http://example.test/get-somePath')

  expect(statusCode).to.equal(202)
  expect(body).to.equal('other-content')

  newScope.done()
})

test('remove interceptor for not found resource', t => {
  expect(
    nock.removeInterceptor({
      hostname: 'example.org',
      path: '/somepath',
    })
  ).to.be.false()

  t.end()
})

test('remove interceptor with proto', t => {
  const scope = nock('https://example.test')
    .get('/somepath')
    .reply(200, 'hey')
  expect(scope.pendingMocks()).to.deep.equal([
    'GET https://example.test:443/somepath',
  ])

  expect(
    nock.removeInterceptor({
      proto: 'https',
      hostname: 'example.test',
      path: '/somepath',
    })
  ).to.be.true()

  expect(scope.pendingMocks()).to.deep.equal([])

  t.end()
})

test('remove interceptor with method', t => {
  const scope = nock('http://example.test')
    .post('/somepath')
    .reply(200, 'hey')
  expect(scope.pendingMocks()).to.deep.equal([
    'POST http://example.test:80/somepath',
  ])

  expect(
    nock.removeInterceptor({
      method: 'post',
      hostname: 'example.test',
      path: '/somepath',
    })
  ).to.be.true()

  expect(scope.pendingMocks()).to.deep.equal([])

  t.end()
})

test('path defaults to /', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'hey')
  expect(scope.pendingMocks()).to.deep.equal(['GET http://example.test:80/'])

  expect(
    nock.removeInterceptor({
      hostname: 'example.test',
    })
  ).to.be.true()

  expect(scope.pendingMocks()).to.deep.equal([])

  t.end()
})

test('does not remove unmatched interceptors', t => {
  const scope1 = nock('http://example.test')
    .get('/somepath')
    .reply(200, 'hey')
  const scope2 = nock('http://example.test')
    .get('/anotherpath')
    .reply(200, 'hey')

  expect(scope1.pendingMocks()).to.deep.equal([
    'GET http://example.test:80/somepath',
  ])
  expect(scope2.pendingMocks()).to.deep.equal([
    'GET http://example.test:80/anotherpath',
  ])

  expect(
    nock.removeInterceptor({
      hostname: 'example.test',
      path: '/anotherpath',
    })
  ).to.be.true()

  expect(scope1.pendingMocks()).to.deep.equal([
    'GET http://example.test:80/somepath',
  ])
  expect(scope2.pendingMocks()).to.deep.equal([])

  t.end()
})
