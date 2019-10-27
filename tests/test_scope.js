'use strict'

const path = require('path')
const { test } = require('tap')
const { expect } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const Interceptor = require('../lib/interceptor')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('scope exposes interceptors', t => {
  const scopes = nock.load(path.join(__dirname, 'fixtures', 'goodRequest.json'))

  expect(scopes).to.be.an.instanceOf(Array)
  expect(scopes).to.have.lengthOf.at.least(1)

  scopes.forEach(scope => {
    scope.interceptors.forEach(interceptor => {
      expect(interceptor).to.be.an.instanceOf(Interceptor)
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
  expect(scope.activeMocks()).to.deep.equal([key])

  // Act.
  scope.remove(key, scope.interceptors[0])

  // Assert.
  expect(scope.activeMocks()).to.deep.equal([])

  t.end()
})

test('scope#remove() is a no-op on a persisted mock', t => {
  const scope = nock('http://example.test')
    .persist()
    .get('/')
    .reply(200)
  const key = 'GET http://example.test:80/'

  // Confidence check.
  expect(scope.activeMocks()).to.deep.equal([key])

  // Act.
  scope.remove(key, scope.interceptors[0])

  // Assert.
  expect(scope.activeMocks()).to.deep.equal([key])

  t.end()
})

test('scope#remove() is a no-op on a nonexistent key', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200)
  const key = 'GET http://example.test:80/'

  // Confidence check.
  expect(scope.activeMocks()).to.deep.equal([key])

  // Act.
  scope.remove('GET http://bogus.test:80/', scope.interceptors[0])

  // Assert.
  expect(scope.activeMocks()).to.deep.equal([key])

  t.end()
})

test('loadDefs throws expected when fs is not available', t => {
  const { loadDefs } = proxyquire('../lib/scope', { fs: null })

  expect(() => loadDefs()).to.throw(Error, 'No fs')

  t.end()
})

test('filter path with function', async t => {
  const scope = nock('http://example.test')
    .filteringPath(() => '/?a=2&b=1')
    .get('/?a=2&b=1')
    .reply()

  const { statusCode } = await got('http://example.test/', {
    query: { a: '1', b: '2' },
  })

  expect(statusCode).to.equal(200)
  scope.done()
})

test('filter path with regexp', async t => {
  const scope = nock('http://example.test')
    .filteringPath(/\d/g, '3')
    .get('/?a=3&b=3')
    .reply()

  const { statusCode } = await got('http://example.test/', {
    query: { a: '1', b: '2' },
  })

  expect(statusCode).to.equal(200)
  scope.done()
})

test('filteringPath with invalid argument throws expected', t => {
  expect(() => nock('http://example.test').filteringPath('abc123')).to.throw(
    Error,
    'Invalid arguments: filtering path should be a function or a regular expression'
  )
  t.end()
})

test('filter body with function', async t => {
  const onFilteringRequestBody = sinon.spy()

  const scope = nock('http://example.test')
    .filteringRequestBody(body => {
      onFilteringRequestBody()
      expect(body).to.equal('mamma mia')
      return 'mamma tua'
    })
    .post('/', 'mamma tua')
    .reply()

  const { statusCode } = await got('http://example.test/', {
    body: 'mamma mia',
  })

  expect(statusCode).to.equal(200)
  expect(onFilteringRequestBody).to.have.been.calledOnce()
  scope.done()
})

test('filter body with regexp', async t => {
  const scope = nock('http://example.test')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    body: 'mamma mia',
  })

  expect(statusCode).to.equal(200)
  scope.done()
})

test('filteringRequestBody with invalid argument throws expected', t => {
  expect(() =>
    nock('http://example.test').filteringRequestBody('abc123')
  ).to.throw(
    Error,
    'Invalid arguments: filtering request body should be a function or a regular expression'
  )
  t.end()
})
