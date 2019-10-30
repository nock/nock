'use strict'

// `persist()` and `optionally()` are closely related. Their tests are both
// contained in this file.

const http = require('http')
const path = require('path')
const assertRejects = require('assert-rejects')
const { expect } = require('chai')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

const textFile = path.join(__dirname, '..', 'assets', 'reply_file_1.txt')

test("pending mocks doesn't include optional mocks", t => {
  nock('http://example.test')
    .get('/nonexistent')
    .optionally()
    .reply(200)

  expect(nock.pendingMocks()).to.be.empty()
  t.end()
})

test('calling optionally(true) on a mock makes it optional', t => {
  nock('http://example.test')
    .get('/nonexistent')
    .optionally(true)
    .reply(200)

  expect(nock.pendingMocks()).to.be.empty()
  t.end()
})

test('calling optionally(false) on a mock leaves it as required', t => {
  nock('http://example.test')
    .get('/nonexistent')
    .optionally(false)
    .reply(200)

  expect(nock.pendingMocks()).to.have.lengthOf(1)
  t.end()
})

test('calling optionally() with a non-boolean argument throws an error', t => {
  const interceptor = nock('http://example.test').get('/')

  expect(() => interceptor.optionally('foo')).to.throw(
    Error,
    'Invalid arguments: argument should be a boolean'
  )
  t.end()
})

test('optional mocks are still functional', t => {
  nock('http://example.test')
    .get('/abc')
    .optionally()
    .reply(200)

  http.get({ host: 'example.test', path: '/abc' }, res => {
    expect(res.statusCode).to.equal(200)
    expect(nock.pendingMocks()).to.be.empty()
    t.end()
  })
})

test('isDone is true with optional mocks outstanding', t => {
  const scope = nock('http://example.test')
    .get('/abc')
    .optionally()
    .reply(200)

  expect(scope.isDone()).to.be.true()
  t.end()
})

test('optional but persisted mocks persist, but never appear as pending', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .optionally()
    .reply(200)
    .persist()

  expect(nock.pendingMocks()).to.be.empty()

  const response1 = await got('http://example.test/')
  expect(response1.statusCode).to.equal(200)

  expect(nock.pendingMocks()).to.be.empty()

  const response2 = await got('http://example.test/')
  expect(response2.statusCode).to.equal(200)
  expect(nock.pendingMocks()).to.be.empty()

  scope.done()
})

test('optional repeated mocks execute repeatedly, but never appear as pending', t => {
  nock('http://example.test')
    .get('/456')
    .optionally()
    .times(2)
    .reply(200)

  expect(nock.pendingMocks()).to.be.empty()
  http.get({ host: 'example.test', path: '/456' }, res => {
    expect(res.statusCode).to.equal(200)
    expect(nock.pendingMocks()).to.be.empty()

    http.get({ host: 'example.test', path: '/456' }, res => {
      expect(res.statusCode).to.equal(200)
      expect(nock.pendingMocks()).to.be.empty()
      t.end()
    })
  })
})

test("activeMocks returns optional mocks only before they're completed", t => {
  nock('http://example.test')
    .get('/optional')
    .optionally()
    .reply(200)

  expect(nock.activeMocks()).to.deep.equal([
    'GET http://example.test:80/optional',
  ])
  http.get({ host: 'example.test', path: '/optional' }, function(res) {
    expect(nock.activeMocks()).to.be.empty()
    t.end()
  })
})

test('activeMocks always returns persisted mocks', async t => {
  const scope = nock('http://example.test')
    .get('/persisted')
    .reply(200)
    .persist()

  expect(nock.activeMocks()).to.deep.equal([
    'GET http://example.test:80/persisted',
  ])

  await got('http://example.test/persisted')

  expect(nock.activeMocks()).to.deep.equal([
    'GET http://example.test:80/persisted',
  ])

  scope.done()
})

test('persists interceptors', async t => {
  const scope = nock('http://example.test')
    .persist()
    .get('/')
    .reply(200, 'Persisting all the way')

  expect(scope.isDone()).to.be.false()

  await got('http://example.test/')

  expect(scope.isDone()).to.be.true()

  await got('http://example.test/')

  expect(scope.isDone()).to.be.true()
})

test('Persisted interceptors are in pendingMocks initially', async t => {
  const scope = nock('http://example.test')
    .get('/abc')
    .reply(200, 'Persisted reply')
    .persist()

  expect(scope.pendingMocks()).to.deep.equal(['GET http://example.test:80/abc'])
})

test('Persisted interceptors are not in pendingMocks after the first request', async t => {
  const scope = nock('http://example.test')
    .get('/def')
    .reply(200, 'Persisted reply')
    .persist()

  await got('http://example.test/def')

  expect(scope.pendingMocks()).to.deep.equal([])
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
    expect(statusCode).to.equal(200)
    expect(body).to.equal('Hello from the file!')
  }
})

test('stop persisting a persistent nock', async t => {
  const scope = nock('http://example.test')
    .persist(true)
    .get('/')
    .reply(200, 'Persisting all the way')

  expect(scope.isDone()).to.be.false()

  await got('http://example.test/')

  expect(scope.isDone()).to.be.true()
  expect(nock.activeMocks()).to.deep.equal(['GET http://example.test:80/'])

  scope.persist(false)

  await got('http://example.test/')

  expect(nock.activeMocks()).to.be.empty()
  expect(scope.isDone()).to.be.true()

  await assertRejects(
    got('http://example.test/'),
    Error,
    'Nock: No match for request'
  )
})

test("should throw an error when persist flag isn't a boolean", t => {
  expect(() => nock('http://example.test').persist('string')).to.throw(
    Error,
    'Invalid arguments: argument should be a boolean'
  )
  t.end()
})
