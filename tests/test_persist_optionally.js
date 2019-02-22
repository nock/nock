'use strict'

// `persist()` and `optionally()` are closely related. Their tests are both
// contained in this file.

const http = require('http')
const path = require('path')
const got = require('got')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_hook')()

const textFile = path.join(__dirname, '..', 'assets', 'reply_file_1.txt')

test("pending mocks doesn't include optional mocks", t => {
  nock('http://example.test')
    .get('/nonexistent')
    .optionally()
    .reply(200)

  t.deepEqual(nock.pendingMocks(), [])
  t.end()
})

test('calling optionally(true) on a mock makes it optional', t => {
  nock('http://example.test')
    .get('/nonexistent')
    .optionally(true)
    .reply(200)

  t.deepEqual(nock.pendingMocks(), [])
  t.end()
})

test('calling optionally(false) on a mock leaves it as required', t => {
  nock('http://example.test')
    .get('/nonexistent')
    .optionally(false)
    .reply(200)

  t.notEqual(nock.pendingMocks(), [])
  t.end()
})

test('optional mocks are still functional', t => {
  nock('http://example.test')
    .get('/abc')
    .optionally()
    .reply(200)

  http.get({ host: 'example.test', path: '/abc' }, function(res) {
    t.assert(res.statusCode === 200, 'should still mock requests')
    t.deepEqual(nock.pendingMocks(), [])
    t.end()
  })
})

test('isDone is true with optional mocks outstanding', t => {
  const scope = nock('http://example.test')
    .get('/abc')
    .optionally()
    .reply(200)

  t.ok(scope.isDone())
  t.end()
})

test('optional but persisted mocks persist, but never appear as pending', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .optionally()
    .reply(200)
    .persist()

  t.deepEqual(nock.pendingMocks(), [])

  const response1 = await got('http://example.test/')
  t.equal(response1.statusCode, 200)

  t.deepEqual(nock.pendingMocks(), [])

  const response2 = await got('http://example.test/')
  t.equal(response2.statusCode, 200)
  t.deepEqual(nock.pendingMocks(), [])

  scope.done()
})

test('optional repeated mocks execute repeatedly, but never appear as pending', t => {
  nock('http://example.test')
    .get('/456')
    .optionally()
    .times(2)
    .reply(200)

  t.deepEqual(nock.pendingMocks(), [])
  http.get({ host: 'example.test', path: '/456' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock first request')
    t.deepEqual(nock.pendingMocks(), [])

    http.get({ host: 'example.test', path: '/456' }, function(res) {
      t.assert(res.statusCode === 200, 'should mock second request')
      t.deepEqual(nock.pendingMocks(), [])
      t.end()
    })
  })
})

test("activeMocks returns optional mocks only before they're completed", t => {
  nock('http://example.test')
    .get('/optional')
    .optionally()
    .reply(200)

  t.deepEqual(nock.activeMocks(), ['GET http://example.test:80/optional'])
  http.get({ host: 'example.test', path: '/optional' }, function(res) {
    t.deepEqual(nock.activeMocks(), [])
    t.end()
  })
})

test('activeMocks always returns persisted mocks', async t => {
  const scope = nock('http://example.test')
    .get('/persisted')
    .reply(200)
    .persist()

  t.deepEqual(nock.activeMocks(), ['GET http://example.test:80/persisted'])

  await got('http://example.test/persisted')

  t.deepEqual(nock.activeMocks(), ['GET http://example.test:80/persisted'])

  scope.done()
})

test('persists interceptors', async t => {
  const scope = nock('http://example.test')
    .persist()
    .get('/')
    .reply(200, 'Persisting all the way')

  t.false(scope.isDone())

  await got('http://example.test/')

  t.true(scope.isDone())

  await got('http://example.test/')

  t.true(scope.isDone())
})

test('Persisted interceptors are in pendingMocks initially', async t => {
  const scope = nock('http://example.test')
    .get('/abc')
    .reply(200, 'Persisted reply')
    .persist()

  t.deepEqual(scope.pendingMocks(), ['GET http://example.test:80/abc'])
})

test('Persisted interceptors are not in pendingMocks after the first request', async t => {
  const scope = nock('http://example.test')
    .get('/def')
    .reply(200, 'Persisted reply')
    .persist()

  await got('http://example.test/def')

  t.deepEqual(scope.pendingMocks(), [])
})

test('persist reply with file', async t => {
  nock('http://example.test')
    .persist()
    .get('/')
    .replyWithFile(200, textFile)
    .get('/test')
    .reply(200, 'Yay!')

  for (let i = 0; i < 2; ++i) {
    const { statusCode, body } = await got('http://example.test/')
    t.equal(statusCode, 200)
    t.equal(body, 'Hello from the file!')
  }
})

test('stop persisting a persistent nock', async t => {
  const scope = nock('http://example.test')
    .persist(true)
    .get('/')
    .reply(200, 'Persisting all the way')

  t.false(scope.isDone())

  await got('http://example.test/')

  t.true(scope.isDone())
  t.deepEqual(nock.activeMocks(), ['GET http://example.test:80/'])

  scope.persist(false)

  await got('http://example.test/')

  t.equal(nock.activeMocks().length, 0)
  t.true(scope.isDone())

  await t.rejects(async () => got('http://example.test/'), {
    message: 'Nock: No match for request',
  })
})

test("should throw an error when persist flag isn't a boolean", t => {
  t.throws(() => nock('http://persist.com').persist('string'), {
    message: 'Invalid arguments: argument should be a boolean',
  })
  t.end()
})
