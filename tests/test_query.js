'use strict'

const { test } = require('tap')
const { expect } = require('chai')
const sinon = require('sinon')
const url = require('url')
const nock = require('..')
const got = require('./got_client')
const assertRejects = require('assert-rejects')

require('./cleanup_after_each')()
require('./setup')

test('query() matches a query string of the same name=value', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query({ foo: 'bar' })
    .reply()

  const { statusCode } = await got('http://example.test/?foo=bar')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() matches multiple query strings of the same name=value', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query({ foo: 'bar', baz: 'foz' })
    .reply()

  const { statusCode } = await got('http://example.test/?foo=bar&baz=foz')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() matches multiple query strings of the same name=value regardless of order', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query({ foo: 'bar', baz: 'foz' })
    .reply()

  const { statusCode } = await got('http://example.test/?baz=foz&foo=bar')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('literal query params have the same behavior as calling query() directly', async t => {
  const scope = nock('http://example.test')
    .get('/foo?bar=baz')
    .reply()

  const { statusCode } = await got('http://example.test/foo?bar=baz')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() matches query values regardless of their type of declaration', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query({ num: 1, bool: true, empty: null, str: 'fou' })
    .reply()

  const { statusCode } = await got(
    'http://example.test/?num=1&bool=true&empty=&str=fou'
  )

  expect(statusCode).to.equal(200)
  scope.done()
})

test("query() doesn't match query values of requests without query string", async t => {
  const scope1 = nock('http://example.test')
    .get('/')
    .query({ num: 1, bool: true, empty: null, str: 'fou' })
    .reply(200, 'scope1')

  const scope2 = nock('http://example.test')
    .get('/')
    .reply(200, 'scope2')

  const { statusCode, body } = await got('http://example.test/')

  expect(statusCode).to.equal(200)
  expect(body).to.equal('scope2')
  scope2.done()
  expect(scope1.isDone()).to.be.false()
})

test('query() matches a query string using regexp', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query({ foo: /.*/ })
    .reply()

  const { statusCode } = await got('http://example.test/?foo=bar')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() accepts URLSearchParams as input', async t => {
  const params = new url.URLSearchParams({ foo: 'bar' })

  const scope = nock('http://example.test')
    .get('/')
    .query(params)
    .reply()

  const { statusCode } = await got('http://example.test?foo=bar')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() throws if query params have already been defined', t => {
  const interceptor = nock('http://example.test').get('/?foo=bar')

  expect(() => {
    interceptor.query({ foo: 'baz' })
  }).to.throw(Error, 'Query parameters have already been defined')

  t.done()
})

test('query() throws if query() was already called', t => {
  const interceptor = nock('http://example.test')
    .get('/')
    .query({ foo: 'bar' })

  expect(() => {
    interceptor.query({ baz: 'qux' })
  }).to.throw(Error, 'Query parameters have already been defined')

  t.done()
})

test('query() throws for invalid arguments', t => {
  const interceptor = nock('http://example.test').get('/')

  expect(() => {
    interceptor.query('foo=bar')
  }).to.throw(Error, 'Argument Error: foo=bar')

  t.done()
})

test('query() matches a query string that contains special RFC3986 characters', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query({ 'foo&bar': 'hello&world' })
    .reply()

  const { statusCode } = await got('http://example.test/', {
    query: { 'foo&bar': 'hello&world' },
  })

  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() expects unencoded query params', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query({ foo: 'hello%20world' })
    .reply()

  await assertRejects(
    got('http://example.test/?foo=hello%20world'),
    Error,
    'Nock: No match for request'
  )

  const { statusCode } = await got('http://example.test/?foo=hello%2520world')
  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() matches a query string with pre-encoded values', async t => {
  const scope = nock('http://example.test', { encodedQueryParams: true })
    .get('/')
    .query({ foo: 'hello%20world' })
    .reply()

  const { statusCode } = await got('http://example.test/?foo=hello%20world')
  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() with "true" will allow all query strings to pass', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query(true)
    .reply()

  const { statusCode } = await got('http://example.test/?foo=hello%20world')
  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() with "{}" will allow a match against ending in ?', async t => {
  const scope = nock('http://example.test')
    .get('/noquerystring')
    .query({})
    .reply()

  const { statusCode } = await got('http://example.test/noquerystring?')
  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() with a function, function called with actual queryObject', async t => {
  const queryFn = sinon.stub().returns(true)
  const scope = nock('http://example.test')
    .get('/')
    .query(queryFn)
    .reply()

  const { statusCode } = await got('http://example.test/?foo=bar&a=1&b=2')
  expect(statusCode).to.equal(200)

  expect(queryFn).to.have.been.calledOnceWithExactly({
    foo: 'bar',
    a: '1',
    b: '2',
  })

  scope.done()
})

test('query() with a function, function return true the query treat as matched', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query(() => true)
    .reply()

  const { statusCode } = await got(
    'http://example.test/?ignore=the&actual=query'
  )
  expect(statusCode).to.equal(200)
  scope.done()
})

test('query() with a function, function return false the query treat as Un-matched', async t => {
  nock('http://example.test')
    .get('/')
    .query(() => false)
    .reply()

  await assertRejects(
    got('http://example.test/?i=should&pass=?'),
    Error,
    'Nock: No match for request'
  )
})

test('query() will not match when a query string does not match name=value', async t => {
  nock('http://example.test')
    .get('/')
    .query({ foo: 'bar' })
    .reply()

  await assertRejects(
    got('http://example.test/?foo=baz'),
    Error,
    'Nock: No match for request'
  )
})

test('query() will not match when a query string is present that was not registered', async t => {
  nock('http://example.test')
    .get('/')
    .query({ foo: 'bar' })
    .reply()

  await assertRejects(
    got('http://example.test/?foo=bar&baz=foz'),
    Error,
    'Nock: No match for request'
  )
})

test('query() will not match when a query string is malformed', async t => {
  // This is a valid query string so it's not really malformed, just not
  // matching. Should this test be removed?
  nock('http://example.test')
    .get('/')
    .query({ foo: 'bar' })
    .reply()

  await assertRejects(
    got('http://example.test/?foobar'),
    Error,
    'Nock: No match for request'
  )
})

test('query() will not match when a query string has fewer correct values than expected', async t => {
  nock('http://example.test')
    .get('/')
    .query({
      num: 1,
      bool: true,
      empty: null,
      str: 'fou',
    })
    .reply()

  await assertRejects(
    got('http://example.test/?num=1str=fou'),
    Error,
    'Nock: No match for request'
  )
})

test('query(true) will match when the path has no query', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .query(true)
    .reply()

  const { statusCode } = await got('http://example.test/')
  expect(statusCode).to.equal(200)
  scope.done()
})

test('query matching should not consider request arrays equal to comma-separated expectations', async t => {
  nock('http://example.test')
    .get('/')
    .query({
      foo: 'bar,baz',
    })
    .reply()

  await assertRejects(
    got('http://example.test?foo[]=bar&foo[]=baz'),
    got.RequestError,
    'Nock: No match for request'
  )
})

test('query matching should not consider comma-separated requests equal to array expectations', async t => {
  nock('http://example.test')
    .get('/')
    .query({
      foo: ['bar', 'baz'],
    })
    .reply()

  await assertRejects(
    got('http://example.test?foo=bar%2Cbaz'),
    got.RequestError,
    'Nock: No match for request'
  )
})
