'use strict'

const { test } = require('tap')
const common = require('../lib/common')
const matchBody = require('../lib/match_body')

test('matchBody ignores new line characters from strings', t => {
  t.true(
    matchBody(
      'something //here is something more \n',
      'something //here is something more \n\r'
    )
  )
  t.end()
})

test("when spec is a function, it's called with newline characters intact", t => {
  const exampleBody = 'something //here is something more \n'
  let param
  matchBody(body => {
    param = body
  }, exampleBody)
  t.equal(param, exampleBody)
  t.end()
})

test('matchBody should not throw, when headers come node-fetch style as array', t => {
  t.false(
    matchBody.call(
      { headers: { 'Content-Type': ['multipart/form-data;'] } },
      {},
      'test'
    )
  )
  t.end()
})

test("matchBody should not ignore new line characters from strings when Content-Type contains 'multipart'", t => {
  t.true(
    matchBody.call(
      { headers: { 'Content-Type': 'multipart/form-data;' } },
      'something //here is something more \nHello',
      'something //here is something more \nHello'
    )
  )
  t.end()
})

test("matchBody should not ignore new line characters from strings when Content-Type contains 'multipart' (arrays come node-fetch style as array)", t => {
  t.true(
    matchBody.call(
      { headers: { 'Content-Type': ['multipart/form-data;'] } },
      'something //here is something more \nHello',
      'something //here is something more \nHello'
    )
  )
  t.end()
})

test('matchBody uses strict equality for deep comparisons', t => {
  t.false(matchBody({ number: 1 }, '{"number": "1"}'))
  t.end()
})

test('normalizeRequestOptions', t => {
  t.deepEqual(
    common.normalizeRequestOptions({
      host: 'foobar.com:12345',
      port: 12345,
    }),
    {
      host: 'foobar.com:12345',
      hostname: 'foobar.com',
      port: 12345,
      proto: 'http',
    }
  )
  t.deepEqual(
    common.normalizeRequestOptions({
      hostname: 'foobar.com',
    }),
    {
      host: 'foobar.com:80',
      hostname: 'foobar.com',
      port: 80,
      proto: 'http',
    }
  )
  t.deepEqual(common.normalizeRequestOptions({}), {
    host: 'localhost:80',
    // Should this be included?
    // hostname: 'localhost'
    port: 80,
    proto: 'http',
  })
  t.end()
})

test('isBinaryBuffer works', t => {
  //  Returns false for non-buffers.
  t.false(common.isBinaryBuffer())
  t.false(common.isBinaryBuffer(''))

  //  Returns true for binary buffers.
  t.true(common.isBinaryBuffer(Buffer.from('8001', 'hex')))

  //  Returns false for buffers containing strings.
  t.false(common.isBinaryBuffer(Buffer.from('8001', 'utf8')))

  t.end()
})

test('isJSONContent', t => {
  t.true(common.isJSONContent({ 'content-type': 'application/json' }))
  t.true(common.isJSONContent({ 'content-type': ['application/json'] }))
  t.false(common.isJSONContent({ 'content-type': 'text/plain' }))
  t.end()
})

test('headersFieldNamesToLowerCase works', t => {
  t.deepEqual(
    common.headersFieldNamesToLowerCase({
      HoSt: 'example.com',
      'Content-typE': 'plain/text',
    }),
    {
      host: 'example.com',
      'content-type': 'plain/text',
    }
  )
  t.end()
})

test('headersFieldNamesToLowerCase throws on conflicting keys', t => {
  t.throws(
    () =>
      common.headersFieldNamesToLowerCase({
        HoSt: 'example.com',
        HOST: 'example.com',
      }),
    {
      message:
        'Failed to convert header keys to lower case due to field name conflict: host',
    }
  )
  t.end()
})

test('headersFieldsArrayToLowerCase works on arrays', function(t) {
  t.deepEqual(
    // Sort for comparison beause order doesn't matter.
    common.headersFieldsArrayToLowerCase(['HoSt', 'Content-typE']).sort(),
    ['content-type', 'host']
  )
  t.end()
})

test('headersFieldsArrayToLowerCase deduplicates arrays', function(t) {
  t.deepEqual(
    // Sort for comparison beause order doesn't matter.
    common
      .headersFieldsArrayToLowerCase([
        'hosT',
        'HoSt',
        'Content-typE',
        'conTenT-tYpe',
      ])
      .sort(),
    ['content-type', 'host']
  )
  t.end()
})

test('deleteHeadersField deletes fields with case-insensitive field names', t => {
  // Prepare.
  const headers = {
    HoSt: 'example.com',
    'Content-typE': 'plain/text',
  }

  // Confidence check.
  t.true(headers.HoSt)
  t.true(headers['Content-typE'])

  // Act.
  common.deleteHeadersField(headers, 'HOST')
  common.deleteHeadersField(headers, 'CONTENT-TYPE')

  // Assert.
  t.false(headers.HoSt)
  t.false(headers['Content-typE'])

  // Wrap up.
  t.end()
})

test('matchStringOrRegexp', function(t) {
  t.true(
    common.matchStringOrRegexp('to match', 'to match'),
    'true if pattern is string and target matches'
  )
  t.false(
    common.matchStringOrRegexp('to match', 'not to match'),
    "false if pattern is string and target doesn't match"
  )

  t.true(
    common.matchStringOrRegexp(123, 123),
    'true if pattern is number and target matches'
  )

  t.false(
    common.matchStringOrRegexp(undefined, 'to not match'),
    'handle undefined target when pattern is string'
  )
  t.false(
    common.matchStringOrRegexp(undefined, /not/),
    'handle undefined target when pattern is regex'
  )

  t.ok(
    common.matchStringOrRegexp('to match', /match/),
    'match if pattern is regex and target matches'
  )
  t.false(
    common.matchStringOrRegexp('to match', /not/),
    "false if pattern is regex and target doesn't match"
  )
  t.end()
})

test('overrideRequests', t => {
  t.on('end', () => common.restoreOverriddenRequests())
  common.overrideRequests()
  // Second call throws.
  t.throws(() => common.overrideRequests(), {
    message: "Module's request already overridden for http protocol.",
  })
  t.end()
})

test('restoreOverriddenRequests can be called more than once', t => {
  common.restoreOverriddenRequests()
  common.restoreOverriddenRequests()
  t.end()
})

test('stringifyRequest', function(t) {
  const exampleOptions = {
    method: 'POST',
    port: 81,
    proto: 'http',
    hostname: 'www.example.com',
    path: '/path/1',
    headers: { cookie: 'fiz=baz' },
  }

  t.deepEqual(
    JSON.parse(common.stringifyRequest(exampleOptions, { foo: 'bar' })),
    {
      method: 'POST',
      url: 'http://www.example.com:81/path/1',
      headers: {
        cookie: 'fiz=baz',
      },
      body: {
        foo: 'bar',
      },
    }
  )

  t.deepEqual(
    JSON.parse(
      common.stringifyRequest(
        {
          ...exampleOptions,
          method: 'GET',
        },
        null
      )
    ),
    {
      method: 'GET',
      url: 'http://www.example.com:81/path/1',
      headers: {
        cookie: 'fiz=baz',
      },
    }
  )

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

  t.deepEqual(common.headersArrayToObject(headers), {
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

  t.deepEqual(common.headersArrayToObject(headersMultipleSetCookies), {
    'content-type': 'application/json; charset=utf-8',
    'last-modified': 'foobar',
    expires: 'fizbuzz',
    'set-cookie': [
      'foo=bar; Domain=.github.com; Path=/',
      'fiz=baz; Domain=.github.com; Path=/',
      'foo=baz; Domain=.github.com; Path=/',
    ],
  })

  t.end()
})
