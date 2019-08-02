'use strict'

const path = require('path')
const { test } = require('tap')
const proxyquire = require('proxyquire').noPreserveCache()
const Interceptor = require('../lib/interceptor')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

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

  t.end()
})

test('loadDefs throws expected when fs is not available', t => {
  const { loadDefs } = proxyquire('../lib/scope', { fs: null })

  t.throws(() => loadDefs(), { message: 'No fs' })

  t.end()
})

test('filter path with function', async t => {
  const scope = nock('http://example.test')
    .filteringPath(() => '/?a=2&b=1')
    .get('/?a=2&b=1')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    query: { a: '1', b: '2' },
  })

  t.equal(statusCode, 200)
  scope.done()
})

test('filter path with regexp', async t => {
  const scope = nock('http://example.test')
    .filteringPath(/\d/g, '3')
    .get('/?a=3&b=3')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    query: { a: '1', b: '2' },
  })

  t.equal(statusCode, 200)
  scope.done()
})

test('filteringPath with invalid argument throws expected', t => {
  t.throws(() => nock('http://example.test').filteringPath('abc123'), {
    message:
      'Invalid arguments: filtering path should be a function or a regular expression',
  })
  t.end()
})

test('filter body with function', async t => {
  let filteringRequestBodyCounter = 0

  const scope = nock('http://example.test')
    .filteringRequestBody(body => {
      ++filteringRequestBodyCounter
      t.equal(body, 'mamma mia')
      return 'mamma tua'
    })
    .post('/', 'mamma tua')
    .reply()

  const { statusCode } = await got('http://example.test/', {
    body: 'mamma mia',
  })

  t.is(statusCode, 200)
  scope.done()
  t.equal(filteringRequestBodyCounter, 1)
})

test('filter body with function and empty body', async t => {
  let filteringRequestBodyCounter = 0

  const scope = nock('http://example.test')
    .filteringRequestBody(body => {
      ++filteringRequestBodyCounter
      return true
    })
    .post('/')
    .reply()

  const { statusCode } = await got.post('http://example.test/')

  t.is(statusCode, 200)
  scope.done()
  t.equal(filteringRequestBodyCounter, 1)
})

test('filter body with regexp', async t => {
  const scope = nock('http://example.test')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    body: 'mamma mia',
  })

  t.equal(statusCode, 200)
  scope.done()
})

test('filteringRequestBody with invalid argument throws expected', t => {
  t.throws(() => nock('http://example.test').filteringRequestBody('abc123'), {
    message:
      'Invalid arguments: filtering request body should be a function or a regular expression',
  })
  t.end()
})
