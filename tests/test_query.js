'use strict'

const mikealRequest = require('request')
const { test } = require('tap')
const url = require('url')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('query() matches a query string of the same name=value', t => {
  nock('http://example.test')
    .get('/')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('http://example.test/?foo=bar', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() matches multiple query strings of the same name=value', t => {
  nock('http://example.test')
    .get('/')
    .query({ foo: 'bar', baz: 'foz' })
    .reply(200)

  mikealRequest('http://example.test/?foo=bar&baz=foz', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('literal query params have the same behavior as calling query() directly', async t => {
  const scope = nock('http://example.test')
    .get('/foo?bar=baz')
    .reply()

  const { statusCode } = await got('http://example.test/foo?bar=baz')

  t.is(statusCode, 200)
  scope.done()
})

test('query() matches multiple query strings of the same name=value regardless of order', t => {
  nock('http://example.test')
    .get('/')
    .query({ foo: 'bar', baz: 'foz' })
    .reply(200)

  mikealRequest('http://example.test/?baz=foz&foo=bar', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() matches query values regardless of their type of declaration', t => {
  nock('http://example.test')
    .get('/')
    .query({ num: 1, bool: true, empty: null, str: 'fou' })
    .reply(200)

  mikealRequest('http://example.test/?num=1&bool=true&empty=&str=fou', function(
    err,
    res
  ) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test("query() doesn't match query values of requests without query string", t => {
  nock('http://example.test')
    .get('/')
    .query({ num: 1, bool: true, empty: null, str: 'fou' })
    .reply(200, 'scope1')

  nock('http://example.test')
    .get('/')
    .reply(200, 'scope2')

  mikealRequest('http://example.test', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'scope2')
    t.end()
  })
})

test('query() matches a query string using regexp', t => {
  nock('http://example.test')
    .get('/')
    .query({ foo: /.*/ })
    .reply(200)

  mikealRequest('http://example.test/?foo=bar', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() accepts URLSearchParams as input', async t => {
  const params = new url.URLSearchParams({
    foo: 'bar',
  })

  const scope = nock('http://example.test')
    .get('/')
    .query(params)
    .reply()

  const { statusCode } = await got('http://example.test?foo=bar')

  t.is(statusCode, 200)
  scope.done()
})

test('query() throws for duplicate keys', async t => {
  const interceptor = nock('http://example.test')
    .get('/')
    .query({ foo: 'bar' })

  t.throws(
    () => {
      interceptor.query({ foo: 'baz' })
    },
    {
      message: 'foo already defined as a query parameter',
    }
  )
})

test('query() matches a query string that contains special RFC3986 characters', t => {
  nock('http://example.test')
    .get('/')
    .query({ 'foo&bar': 'hello&world' })
    .reply(200)

  const options = {
    uri: 'http://example.test',
    qs: {
      'foo&bar': 'hello&world',
    },
  }

  mikealRequest(options, function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() expects unencoded query params', t => {
  nock('http://example.test')
    .get('/')
    .query({ foo: 'hello%20world' })
    .reply(200)

  mikealRequest('http://example.test?foo=hello%20world', function(err, res) {
    t.similar(err.toString(), /Error: Nock: No match for request/)
    t.end()
  })
})

test('query() matches a query string with pre-encoded values', t => {
  nock('http://example.test', { encodedQueryParams: true })
    .get('/')
    .query({ foo: 'hello%20world' })
    .reply(200)

  mikealRequest('http://example.test?foo=hello%20world', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with "true" will allow all query strings to pass', t => {
  nock('http://example.test')
    .get('/')
    .query(true)
    .reply(200)

  mikealRequest('http://example.test/?foo=bar&a=1&b=2', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with "{}" will allow a match against ending in ?', t => {
  nock('http://example.test')
    .get('/noquerystring')
    .query({})
    .reply(200)

  mikealRequest('http://example.test/noquerystring?', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with a function, function called with actual queryObject', t => {
  let queryObject

  const queryValidator = function(qs) {
    queryObject = qs
    return true
  }

  nock('http://example.test')
    .get('/')
    .query(queryValidator)
    .reply(200)

  mikealRequest('http://example.test/?foo=bar&a=1&b=2', function(err, res) {
    if (err) throw err
    t.deepEqual(queryObject, { foo: 'bar', a: '1', b: '2' })
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with a function, function return true the query treat as matched', t => {
  const alwasyTrue = function() {
    return true
  }

  nock('http://example.test')
    .get('/')
    .query(alwasyTrue)
    .reply(200)

  mikealRequest('http://example.test/?igore=the&actual=query', function(
    err,
    res
  ) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with a function, function return false the query treat as Un-matched', t => {
  const alwayFalse = function() {
    return false
  }

  nock('http://example.test')
    .get('/')
    .query(alwayFalse)
    .reply(200)

  mikealRequest('http://example.test/?i=should&pass=?', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'http://example.test/?i=should&pass=?',
          headers: { host: 'example.test' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string does not match name=value', t => {
  nock('https://example.test')
    .get('/b')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('https://example.test/b?foo=baz', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'https://example.test/b?foo=baz',
          headers: { host: 'example.test' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string is present that was not registered', t => {
  nock('https://example.test')
    .get('/c')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('https://example.test/c?foo=bar&baz=foz', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'https://example.test/c?foo=bar&baz=foz',
          headers: { host: 'example.test' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string is malformed', t => {
  nock('https://example.test')
    .get('/d')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('https://example.test/d?foobar', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'https://example.test/d?foobar',
          headers: { host: 'example.test' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string has fewer correct values than expected', t => {
  nock('http://example.test')
    .get('/')
    .query({
      num: 1,
      bool: true,
      empty: null,
      str: 'fou',
    })
    .reply(200)

  mikealRequest('http://example.test/?num=1str=fou', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'http://example.test/?num=1str=fou',
          headers: { host: 'example.test' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query(true) will match when the path has no query', t => {
  nock('http://example.test')
    .get('/')
    .query(true)
    .reply(200)

  mikealRequest('http://example.test', function(err, res) {
    t.ok(!err, 'no error')
    t.ok(res)
    t.equal(res.statusCode, 200)
    t.end()
  })
})
