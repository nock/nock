'use strict'

const { test } = require('tap')
const got = require('got')
const nock = require('..')

test('remove interceptor for GET resource', async t => {
  nock('http://example.test')
    .get('/somepath')
    .reply(200, 'hey')

  t.true(
    nock.removeInterceptor({
      hostname: 'example.test',
      path: '/somepath',
    })
  )

  const newScope = nock('http://example.test')
    .get('/somepath')
    .reply(202, 'other-content')

  const { statusCode, body } = await got('http://example.test/somepath')

  t.equal(statusCode, 202)
  t.equal(body, 'other-content')

  newScope.done()
})

test('remove interceptor removes given interceptor', async t => {
  const givenInterceptor = nock('http://example.test').get('/somepath')
  givenInterceptor.reply(200, 'hey')

  t.true(nock.removeInterceptor(givenInterceptor))

  const newScope = nock('http://example.test')
    .get('/somepath')
    .reply(202, 'other-content')

  const { statusCode, body } = await got('http://example.test/somepath')

  t.equal(statusCode, 202)
  t.equal(body, 'other-content')

  newScope.done()
})

test('remove interceptor removes interceptor from pending requests', t => {
  const givenInterceptor = nock('http://example.org').get('/somepath')
  const scope = givenInterceptor.reply(200, 'hey')

  t.deepEqual(scope.pendingMocks(), ['GET http://example.org:80/somepath'])

  t.true(nock.removeInterceptor(givenInterceptor))

  t.deepEqual(scope.pendingMocks(), [])

  t.end()
})

test('remove interceptor removes given interceptor for https', async t => {
  const givenInterceptor = nock('https://example.test').get('/somepath')
  const scope = givenInterceptor.reply(200, 'hey')

  t.deepEqual(scope.pendingMocks(), ['GET https://example.test:443/somepath'])

  t.true(nock.removeInterceptor(givenInterceptor))

  const newScope = nock('https://example.test')
    .get('/somepath')
    .reply(202, 'other-content')

  const { statusCode, body } = await got('https://example.test/somepath')

  t.equal(statusCode, 202)
  t.equal(body, 'other-content')

  newScope.done()
})

test('remove interceptor removes given interceptor for regex path', async t => {
  const givenInterceptor = nock('http://example.test').get(/somePath$/)
  const scope = givenInterceptor.reply(200, 'hey')

  t.deepEqual(scope.pendingMocks(), ['GET http://example.test:80//somePath$/'])

  t.true(nock.removeInterceptor(givenInterceptor))

  const newScope = nock('http://example.test')
    .get(/somePath$/)
    .reply(202, 'other-content')

  const { statusCode, body } = await got('http://example.test/get-somePath')

  t.equal(statusCode, 202)
  t.equal(body, 'other-content')

  newScope.done()
})

test('remove interceptor for not found resource', t => {
  t.false(
    nock.removeInterceptor({
      hostname: 'example.org',
      path: '/somepath',
    })
  )

  t.end()
})
