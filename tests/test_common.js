'use strict'

// Nock's strategy is to test as much as possible either through the public API
// or, when that is not possible, through the mock surface.
//
// Whenever tests can be written against the public API or the mock surface, do
// that rather than add tests here.
//
// This helps ensure that the code in the common module stays tight, and that
// it's all necessary for handling the supported use cases. The project enforces
// 100% test coverage, so when utility code falls out of test, we know it's time
// to remove it.

const http = require('http')
const { expect } = require('chai')
const sinon = require('sinon')
const { test } = require('tap')
const nock = require('..')

const common = require('../lib/common')
const matchBody = require('../lib/match_body')

require('./cleanup_after_each')()
require('./setup')

// match_body has its own test file that tests the functionality from the API POV.
// Since it's not in common.js does it make more sense for these six unit tests to move into that file?
test('matchBody ignores new line characters from strings', t => {
  const result = matchBody(
    {},
    'something //here is something more \n',
    'something //here is something more \n\r'
  )
  expect(result).to.equal(true)
  t.end()
})

test("when spec is a function, it's called with newline characters intact", t => {
  const exampleBody = 'something //here is something more \n'
  let param
  const matchCb = body => {
    param = body
  }

  matchBody({}, matchCb, exampleBody)
  expect(param).to.equal(exampleBody)
  t.end()
})

test('matchBody should not throw, when headers come node-fetch style as array', t => {
  const result = matchBody(
    { headers: { 'Content-Type': ['multipart/form-data;'] } },
    {},
    'test'
  )
  expect(result).to.equal(false)
  t.end()
})

test("matchBody should not ignore new line characters from strings when Content-Type contains 'multipart'", t => {
  const result = matchBody(
    { headers: { 'Content-Type': 'multipart/form-data;' } },
    'something //here is something more \nHello',
    'something //here is something more \nHello'
  )
  expect(result).to.equal(true)
  t.end()
})

test("matchBody should not ignore new line characters from strings when Content-Type contains 'multipart' (arrays come node-fetch style as array)", t => {
  const result = matchBody(
    { headers: { 'Content-Type': ['multipart/form-data;'] } },
    'something //here is something more \nHello',
    'something //here is something more \nHello'
  )
  expect(result).to.equal(true)
  t.end()
})

test('matchBody uses strict equality for deep comparisons', t => {
  const result = matchBody({}, { number: 1 }, '{"number": "1"}')
  expect(result).to.equal(false)
  t.end()
})

test('normalizeRequestOptions, with port', t => {
  const result = common.normalizeRequestOptions({
    host: 'example.test:12345',
    port: 12345,
  })

  const expected = {
    host: 'example.test:12345',
    hostname: 'example.test',
    port: 12345,
    proto: 'http',
  }

  expect(result).to.deep.equal(expected)
  t.end()
})

test('normalizeRequestOptions, without port', t => {
  const result = common.normalizeRequestOptions({
    hostname: 'example.test',
  })

  const expected = {
    host: 'example.test:80',
    hostname: 'example.test',
    port: 80,
    proto: 'http',
  }

  expect(result).to.deep.equal(expected)
  t.end()
})

test('normalizeRequestOptions, empty options', t => {
  const result = common.normalizeRequestOptions({})

  const expected = {
    host: 'localhost:80',
    // Should this be included?
    // hostname: 'localhost'
    port: 80,
    proto: 'http',
  }

  expect(result).to.deep.equal(expected)
  t.end()
})

test('isUtf8Representable works', t => {
  // Returns false for buffers that aren't utf8 representable.
  expect(common.isUtf8Representable(Buffer.from('8001', 'hex'))).to.equal(false)

  // Returns true for buffers containing strings.
  expect(common.isUtf8Representable(Buffer.from('8001', 'utf8'))).to.equal(true)

  t.end()
})

test('isJSONContent', t => {
  expect(common.isJSONContent({ 'content-type': 'application/json' })).to.equal(
    true
  )
  expect(
    common.isJSONContent({ 'content-type': 'application/json; charset=utf-8' })
  ).to.equal(true)
  expect(common.isJSONContent({ 'content-type': 'text/plain' })).to.equal(false)
  t.end()
})

test('headersFieldNamesToLowerCase works', t => {
  const result = common.headersFieldNamesToLowerCase({
    HoSt: 'example.test',
    'Content-typE': 'plain/text',
  })
  const expected = {
    host: 'example.test',
    'content-type': 'plain/text',
  }

  expect(result).to.deep.equal(expected)
  t.end()
})

test('headersFieldNamesToLowerCase throws on conflicting keys', t => {
  expect(() =>
    common.headersFieldNamesToLowerCase({
      HoSt: 'example.test',
      HOST: 'example.test',
    })
  ).to.throw(
    'Failed to convert header keys to lower case due to field name conflict: host'
  )
  t.end()
})

test('headersFieldsArrayToLowerCase works on arrays', t => {
  // Sort for comparison because order doesn't matter.
  const result = common
    .headersFieldsArrayToLowerCase(['HoSt', 'Content-typE'])
    .sort()

  expect(result).to.deep.equal(['content-type', 'host'])
  t.end()
})

test('headersFieldsArrayToLowerCase de-duplicates arrays', t => {
  // Sort for comparison because order doesn't matter.
  const result = common
    .headersFieldsArrayToLowerCase([
      'hosT',
      'HoSt',
      'Content-typE',
      'conTenT-tYpe',
    ])
    .sort()

  expect(result).to.deep.equal(['content-type', 'host'])
  t.end()
})

test('deleteHeadersField deletes fields with case-insensitive field names', t => {
  // Prepare.
  const headers = {
    HoSt: 'example.test',
    'Content-typE': 'plain/text',
  }

  // Confidence check.
  expect(headers).to.have.property('HoSt')
  expect(headers).to.have.property('Content-typE')

  // Act.
  common.deleteHeadersField(headers, 'HOST')
  common.deleteHeadersField(headers, 'CONTENT-TYPE')

  // Assert.
  expect(headers).to.not.have.property('HoSt')
  expect(headers).to.not.have.property('Content-typE')

  // Wrap up.
  t.end()
})

test('deleteHeadersField removes multiple fields with same case-insensitive names', t => {
  const headers = {
    foo: 'one',
    FOO: 'two',
    'X-Foo': 'three',
  }

  common.deleteHeadersField(headers, 'foo')

  expect(headers).to.deep.equal({ 'X-Foo': 'three' })
  t.done()
})

test('deleteHeadersField throws for invalid headers', t => {
  expect(() => common.deleteHeadersField('foo', 'Content-Type')).to.throw(
    'headers must be an object'
  )
  t.done()
})

test('deleteHeadersField throws for invalid field name', t => {
  expect(() => common.deleteHeadersField({}, /cookie/)).to.throw(
    'field name must be a string'
  )
  t.done()
})

test('matchStringOrRegexp', t => {
  expect(common.matchStringOrRegexp('to match', 'to match')).to.equal(
    true,
    'true if pattern is string and target matches'
  )

  expect(common.matchStringOrRegexp('to match', 'not to match')).to.equal(
    false,
    "false if pattern is string and target doesn't match"
  )

  expect(common.matchStringOrRegexp(123, 123)).to.equal(
    true,
    'true if pattern is number and target matches'
  )

  expect(common.matchStringOrRegexp(undefined, 'to not match')).to.equal(
    false,
    'handle undefined target when pattern is string'
  )

  expect(common.matchStringOrRegexp(undefined, /not/)).to.equal(
    false,
    'handle undefined target when pattern is regex'
  )

  expect(common.matchStringOrRegexp('to match', /match/)).to.equal(
    true,
    'match if pattern is regex and target matches'
  )

  expect(common.matchStringOrRegexp('to match', /not/)).to.equal(
    false,
    "false if pattern is regex and target doesn't match"
  )
  t.end()
})

test('overrideRequests', t => {
  t.on('end', () => common.restoreOverriddenRequests())
  nock.restore()
  common.overrideRequests()
  // Second call throws.
  expect(() => common.overrideRequests()).to.throw(
    "Module's request already overridden for http protocol."
  )
  t.end()
})

test('restoreOverriddenRequests can be called more than once', t => {
  common.restoreOverriddenRequests()
  common.restoreOverriddenRequests()
  t.end()
})

test('stringifyRequest includes non-default ports', t => {
  const options = {
    method: 'GET',
    port: 3000,
    proto: 'http',
    hostname: 'example.test',
    path: '/',
    headers: {},
  }

  const result = common.stringifyRequest(options, 'foo')

  // We have to parse the object instead of comparing the raw string because the order of keys are not guaranteed.
  expect(JSON.parse(result)).to.deep.equal({
    method: 'GET',
    url: 'http://example.test:3000/',
    headers: {},
    body: 'foo',
  })

  t.end()
})

test('stringifyRequest does not include default http port', t => {
  const options = {
    method: 'GET',
    port: 80,
    proto: 'http',
    hostname: 'example.test',
    path: '/',
    headers: {},
  }

  const result = common.stringifyRequest(options, 'foo')

  expect(JSON.parse(result)).to.deep.equal({
    method: 'GET',
    url: 'http://example.test/',
    headers: {},
    body: 'foo',
  })

  t.end()
})

test('stringifyRequest does not include default https port', t => {
  const options = {
    method: 'POST',
    port: 443,
    proto: 'https',
    hostname: 'example.test',
    path: '/the/path',
    headers: {},
  }

  const result = common.stringifyRequest(options, 'foo')

  expect(JSON.parse(result)).to.deep.equal({
    method: 'POST',
    url: 'https://example.test/the/path',
    headers: {},
    body: 'foo',
  })

  t.end()
})

test('stringifyRequest defaults optional options', t => {
  const options = {
    port: 80,
    proto: 'http',
    hostname: 'example.test',
    headers: {},
  }

  const result = common.stringifyRequest(options, 'foo')

  expect(JSON.parse(result)).to.deep.equal({
    method: 'GET',
    url: 'http://example.test',
    headers: {},
    body: 'foo',
  })

  t.end()
})

test('stringifyRequest passes headers through', t => {
  const options = {
    method: 'GET',
    port: 80,
    proto: 'http',
    hostname: 'example.test',
    path: '/',
    headers: { cookie: 'fiz=baz', 'set-cookie': ['hello', 'world'] },
  }

  const result = common.stringifyRequest(options, 'foo')

  expect(JSON.parse(result)).to.deep.equal({
    method: 'GET',
    url: 'http://example.test/',
    headers: { cookie: 'fiz=baz', 'set-cookie': ['hello', 'world'] },
    body: 'foo',
  })

  t.end()
})

test('stringifyRequest the body is always treated as a string', t => {
  const options = {
    method: 'GET',
    port: 80,
    proto: 'http',
    hostname: 'example.test',
    path: '/',
    headers: {},
  }

  const result = common.stringifyRequest(options, '{"hello":"world"}')

  expect(JSON.parse(result)).to.deep.equal({
    method: 'GET',
    url: 'http://example.test/',
    headers: {},
    body: '{"hello":"world"}',
  })

  t.end()
})

test('headersArrayToObject', function(t) {
  const headers = [
    'Content-Type',
    'application/json; charset=utf-8',
    'Last-Modified',
    'foobar',
    'Expires',
    'fizbuzz',
  ]

  expect(common.headersArrayToObject(headers)).to.deep.equal({
    'content-type': 'application/json; charset=utf-8',
    'last-modified': 'foobar',
    expires: 'fizbuzz',
  })

  const headersMultipleSetCookies = headers.concat([
    'Set-Cookie',
    'foo=bar; Domain=.github.com; Path=/',
    'Set-Cookie',
    'fiz=baz; Domain=.github.com; Path=/',
    'set-cookie',
    'foo=baz; Domain=.github.com; Path=/',
  ])

  expect(common.headersArrayToObject(headersMultipleSetCookies)).to.deep.equal({
    'content-type': 'application/json; charset=utf-8',
    'last-modified': 'foobar',
    expires: 'fizbuzz',
    'set-cookie': [
      'foo=bar; Domain=.github.com; Path=/',
      'fiz=baz; Domain=.github.com; Path=/',
      'foo=baz; Domain=.github.com; Path=/',
    ],
  })

  expect(() => common.headersArrayToObject(123)).to.throw(
    'Expected a header array'
  )

  t.end()
})

test('percentEncode encodes extra reserved characters', t => {
  expect(common.percentEncode('foo+(*)!')).to.equal('foo%2B%28%2A%29%21')
  t.done()
})

test('normalizeClientRequestArgs throws for invalid URL', t => {
  // no schema
  expect(() => http.get('example.test')).to.throw(TypeError, 'example.test')
  t.done()
})

test('normalizeClientRequestArgs can include auth info', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .basicAuth({ user: 'user', pass: 'pw' })
    .reply()

  http.get('http://user:pw@example.test')
  scope.isDone()
})

test('normalizeClientRequestArgs with a single callback', async () => {
  // TODO: Only passing a callback isn't currently supported by Nock,
  // but should be in the future as Node allows it.
  const cb = () => {}

  const { options, callback } = common.normalizeClientRequestArgs(cb)

  expect(options).to.deep.equal({})
  expect(callback).to.equal(cb)
})

test('testing timers are deleted correctly', t => {
  const timeoutSpy = sinon.spy()
  const intervalSpy = sinon.spy()
  const immediateSpy = sinon.spy()

  common.setTimeout(timeoutSpy, 0)
  common.setInterval(intervalSpy, 0)
  common.setImmediate(immediateSpy)
  common.removeAllTimers()

  setImmediate(() => {
    expect(timeoutSpy).to.not.have.been.called()
    expect(intervalSpy).to.not.have.been.called()
    expect(immediateSpy).to.not.have.been.called()
    t.end()
  })
})
