'use strict'

const http = require('http')
const assertRejects = require('assert-rejects')
const { test } = require('tap')
const got = require('./got_client')
const nock = require('..')

require('./cleanup_after_each')()

test('filteringScope can be used to match a subdomain', async t => {
  // We scope for www.example.test but through scope filtering we will accept
  // any <subdomain>.other.test.
  const scope = nock('http://example.test', {
    filteringScope: scope => /^http:\/\/.*\.example/.test(scope),
  })
    .get('/')
    .reply()

  const { statusCode } = await got('http://a.example.test')
  t.is(statusCode, 200)
  scope.done()
})

test('filteringScope can be used to match a different domain', async t => {
  const scope = nock('http://example.test', {
    filteringScope: scope => scope === 'http://other.test:80',
  })
    .get('/')
    .reply()

  const { statusCode } = await got('http://other.test')
  t.is(statusCode, 200)
  scope.done()
})

test("when using filteringScope, Host header is set from the scope, not the request's host", t => {
  nock('http://foo.example.test', {
    filteringScope: scope => scope === 'http://bar.other.test:80',
  })
    .get('/')
    .reply()

  const req = http.get({
    host: 'bar.other.test',
    method: 'GET',
    path: '/',
    port: 80,
  })

  t.equivalent(req.getHeaders(), { host: 'foo.example.test' })

  t.done()
})

test("when using filteringScope, can match Host headers using the scope's host", async t => {
  const scope = nock('http://example.test', {
    filteringScope: scope => scope === 'http://other.test:80',
    reqheaders: { Host: 'example.test' },
  })
    .get('/')
    .reply()

  const { statusCode } = await got('http://other.test')
  t.is(statusCode, 200)
  scope.done()
})

// TODO This test is failing.
test('when using filteringScope, reqheaders can prevent match of an explicit Host header', async t => {
  nock('http://example.test', {
    filteringScope: scope => true,
    reqheaders: { Host: 'example.test' },
  })
    .get('/')
    .reply()

  await assertRejects(
    got('http://other.test/', {
      headers: { Host: 'other.test' },
    }),
    Error,
    'Nock: No match for request'
  )
})

test('when multiple scopes have filteringScope, Host header is set from the scope that matches', t => {
  nock('http://bar.example.test', { filteringScope: scope => true })
    .get('/')
    .reply(200)
  nock('http://bazinga.example.test', { filteringScope: scope => true })
    .get('/')
    .reply(200)

  const req1 = http.get({
    host: 'any.test',
    method: 'GET',
    path: '/',
    port: 80,
  })
  const req2 = http.get({
    host: 'any.test',
    method: 'GET',
    path: '/',
    port: 80,
  })

  t.equivalent(req1.getHeaders(), { host: 'bar.example.test' })
  t.equivalent(req2.getHeaders(), { host: 'bazinga.example.test' })

  t.done()
})

test("when multiple scopes have filteringScope, can match Host headers using the scope's host", async t => {
  const scope1 = nock('http://bar.example.test', {
    filteringScope: scope => true,
    reqheaders: { host: 'bar.example.test' },
  })
    .get('/')
    .reply(200)
  const scope2 = nock('http://bazinga.example.test', {
    filteringScope: scope => true,
    reqheaders: { host: 'bazinga.example.test' },
  })
    .get('/')
    .reply(200)
  nock('http://foo.example.test', {
    filteringScope: scope => false,
  })
    .get('/')
    .reply(200)

  const response1 = await got('http://other.test')
  t.is(response1.statusCode, 200)
  scope1.done()

  const response2 = await got('http://other.test')
  t.is(response2.statusCode, 200)
  scope2.done()
})

test('when multiple scopes have filteringScope, correct host header is set on request during playback', async t => {
  const scope1 = nock('http://bar.example.test', {
    filteringScope: scope => true,
  })
    .get('/')
    .reply(
      200,
      () =>
        function() {
          t.is(this.req.getHeader('Host'), 'bar.example.test')
        }
    )
  const scope2 = nock('http://bazinga.example.test', {
    filteringScope: scope => true,
  })
    .get('/')
    .reply(
      200,
      () =>
        function() {
          t.is(this.req.getHeader('Host'), 'bazinga.example.test')
        }
    )
  nock('http://foo.example.test', {
    filteringScope: scope => false,
  })
    .get('/')
    .reply(200)

  const response1 = await got('http://other.test')
  t.is(response1.statusCode, 200)
  scope1.done()

  const response2 = await got('http://other.test')
  t.is(response2.statusCode, 200)
  scope2.done()
})

// TODO This test throws "no match for request" but the below it is passing.
// The addition of the first scope should not prevent matching the second one.
test('test 1a', async t => {
  nock('http://example.test', {
    reqheaders: { host: 'example.test' },
  })
    .get('/')
    .reply(201)

  nock('http://bogus.test', {
    filteringScope: () => true,
  })
    .get('/')
    .reply(204)

  const { statusCode } = await got('http://example.test/', {
    headers: { Host: 'bogus.test' },
  })
  t.is(statusCode, 204)
})

test('test 1b', async t => {
  nock('http://bogus.test', {
    filteringScope: () => true,
  })
    .get('/')
    .reply(204)

  // This test behaves the same with and without the block below. It's included
  // to better illustrate the disparity between this test and the one before it.
  nock('http://example.test', {
    reqheaders: { host: 'example.test' },
  })
    .get('/')
    .reply(201)

  const { statusCode } = await got('http://example.test/', {
    headers: { Host: 'bogus.test' },
  })
  t.is(statusCode, 204)
})

test('test 3', async t => {
  nock('http://example.test', {
    reqheaders: { host: 'example.test' },
  })
    .get('/')
    .reply(201)

  nock('http://bogus.test', {
    filteringScope: () => true,
  })
    .get('/')
    .reply(204)

  const { statusCode } = await got('http://example.test/')
  t.is(statusCode, 201)
})

// filteringScope ordinarily sets the Host header to match the Host scope.
// Though, what should it do when there is an explicit Host header on the
// request? Should it preserve the explicit Host header and then use it
// for matching, or replace it with the host from the scope? (Don't
// have a strong opinion on that, though we should do something consistent.)
//
// test 4a passes, suggesting the explicit Host header is preserved and
// then used for matching. However test 4b passes too, which suggests the
// opposite.
//
// If Host header constraints should be _ignored_ for matching purposes
// in conjunction with filteringScope, this condition should raise an error,
// and if we have any code solely for that purpose it should be removed.
test('test 4a', async t => {
  nock('http://bogus.test', {
    filteringScope: () => true,
    headers: { Host: 'example.test' },
  })
    .get('/')
    .reply(204)

  const { statusCode } = await got('http://example.test/', {
    headers: { Host: 'example.test' },
  })
  t.is(statusCode, 204)
})

test('test 4b', async t => {
  nock('http://bogus.test', {
    filteringScope: () => true,
    headers: { Host: 'bogus.test' },
  })
    .get('/')
    .reply(204)

  const { statusCode } = await got('http://example.test/', {
    headers: { Host: 'example.test' },
  })
  t.is(statusCode, 204)
})
