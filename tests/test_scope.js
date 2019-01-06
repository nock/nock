'use strict'

const path = require('path')
const nock = require('../')
const Interceptor = require('../lib/interceptor')
const { test } = require('tap')

test('scope exposes interceptors', t => {
  const scopes = nock.load(path.join(__dirname, 'fixtures', 'goodRequest.json'))

  t.ok(Array.isArray(scopes))
  t.ok(scopes.length > 0)

  scopes.forEach(scope => {
    scope.interceptors.forEach(interceptor => {
      t.type(interceptor, Interceptor)
      interceptor.delayConnection(100)
    })
  })

  nock.cleanAll()
  t.end()
})

test('scope#remove() works', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200)
  const key = 'GET http://example.test:80/'

  // Confidence check.
  t.deepEqual(scope.activeMocks(), [key])

  // Act.
  scope.remove(key, scope.interceptors[0])

  // Assert.
  t.deepEqual(scope.activeMocks(), [])

  // Clean up.
  nock.cleanAll()
  t.end()
})

test('scope#remove() is a no-op on a persisted mock', t => {
  const scope = nock('http://example.test')
    .persist()
    .get('/')
    .reply(200)
  const key = 'GET http://example.test:80/'

  // Confidence check.
  t.deepEqual(scope.activeMocks(), [key])

  // Act.
  scope.remove(key, scope.interceptors[0])

  // Assert.
  t.deepEqual(scope.activeMocks(), [key])

  // Clean up.
  nock.cleanAll()
  t.end()
})

test('scope#remove() is a no-op on a nonexistent key', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200)
  const key = 'GET http://example.test:80/'

  // Confidence check.
  t.deepEqual(scope.activeMocks(), [key])

  // Act.
  scope.remove('GET http://bogus.test:80/', scope.interceptors[0])

  // Assert.
  t.deepEqual(scope.activeMocks(), [key])

  // Clean up.
  nock.cleanAll()
  t.end()
})
