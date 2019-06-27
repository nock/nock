'use strict'

const { test } = require('tap')
const common = require('../lib/common')
const matchBody = require('../lib/match_body')
const nock = require('..')

require('./cleanup_after_each')()

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
      host: 'example.test:12345',
      port: 12345,
    }),
    {
      host: 'example.test:12345',
      hostname: 'example.test',
      port: 12345,
      proto: 'http',
    }
  )
  t.deepEqual(
    common.normalizeRequestOptions({
      hostname: 'example.test',
    }),
    {
      host: 'example.test:80',
      hostname: 'example.test',
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

test('isUtf8Representable works', t => {
  //  Returns false for non-buffers.
  t.false(common.isUtf8Representable())
  t.false(common.isUtf8Representable(''))

  //  Returns true for buffers that aren't utf8 representable.
  t.true(common.isUtf8Representable(Buffer.from('8001', 'hex')))

  //  Returns false for buffers containing strings.
  t.false(common.isUtf8Representable(Buffer.from('8001', 'utf8')))

  t.end()
})

test('isJSONContent', t => {
  t.true(common.isJSONContent({ 'content-type': 'application/json' }))
  t.true(
    common.isJSONContent({ 'content-type': 'application/json; charset=utf-8' })
  )
  t.false(common.isJSONContent({ 'content-type': 'text/plain' }))
  t.end()
})

test('headersFieldNamesToLowerCase works', t => {
  t.deepEqual(
    common.headersFieldNamesToLowerCase({
      HoSt: 'example.test',
      'Content-typE': 'plain/text',
    }),
    {
      host: 'example.test',
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
    HoSt: 'example.test',
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

test('deleteHeadersField removes multiple fields with same case-insensitive names', async t => {
  const headers = {
    foo: 'one',
    FOO: 'two',
    'X-Foo': 'three',
  }

  common.deleteHeadersField(headers, 'foo')

  t.deepEqual(headers, { 'X-Foo': 'three' })
})

test('deleteHeadersField throws for invalid headers', async t => {
  t.throws(() => common.deleteHeadersField('foo', 'Content-Type'), {
    message: 'headers must be an object',
  })
})

test('deleteHeadersField throws for invalid field name', async t => {
  t.throws(() => common.deleteHeadersField({}, /cookie/), {
    message: 'field name must be a string',
  })
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
  nock.restore()
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
  t.deepEqual(JSON.parse(result), {
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

  t.deepEqual(JSON.parse(result), {
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

  t.deepEqual(JSON.parse(result), {
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

  t.deepEqual(JSON.parse(result), {
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

  t.deepEqual(JSON.parse(result), {
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

  t.deepEqual(JSON.parse(result), {
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

  t.throws(() => common.headersArrayToObject(123), {
    message: 'Expected a header array',
  })

  t.end()
})

test('percentEncode encodes extra reserved characters', t => {
  t.equal(common.percentEncode('foo+(*)!'), 'foo%2B%28%2A%29%21')
  t.done()
})

test('formatQueryValue formats values with type "number"', t => {
  t.deepEqual(common.formatQueryValue(0, 0), [0, '0'])
  t.deepEqual(common.formatQueryValue(0, -1000), [0, '-1000'])
  t.deepEqual(common.formatQueryValue(0, 500), [0, '500'])
  t.done()
})

test('formatQueryValue formats null & undefined values', t => {
  t.deepEqual(common.formatQueryValue(0, null), [0, ''])
  t.deepEqual(common.formatQueryValue(0, undefined), [0, ''])
  t.done()
})

test('formatQueryValue formats values with type "string"', t => {
  // when stringFormattingFn is not passed
  t.deepEqual(common.formatQueryValue(0, 'foo'), [0, 'foo'])

  // when stringFormattingFn is passed
  t.deepEqual(
    common.formatQueryValue(0, 'FOO', function(str) {
      return typeof str === 'string' ? str.toLowerCase() : str
    }),
    [0, 'foo']
  )
  t.done()
})

test('formatQueryValue does not format regex', t => {
  t.deepEqual(common.formatQueryValue(0, /^foo(bar)?$/i), [0, /^foo(bar)?$/i])
  t.done()
})

test('formatQueryValue formats arrays', t => {
  t.deepEqual(
    common.formatQueryValue(0, [
      0,
      -100,
      'foo',
      { sum: 10 },
      null,
      undefined,
      /^foo(bar)?$/i,
      ['baz', 100],
    ]),
    [
      0,
      [
        '0',
        '-100',
        'foo',
        { sum: '10' },
        '',
        '',
        /^foo(bar)?$/i,
        ['baz', '100'],
      ],
    ]
  )
  t.done()
})

test('formatQueryValue formats objects', t => {
  t.deepEqual(
    common.formatQueryValue(0, {
      a: 5,
      b: 5,
      c: undefined,
      d: null,
      e: [10, undefined, 'foo'],
    }),
    [
      0,
      {
        a: '5',
        b: '5',
        c: '',
        d: '',
        e: ['10', '', 'foo'],
      },
    ]
  )
  t.done()
})

test('formatQueryValue formats keys', t => {
  // when stringFormattingFn is not passed
  t.deepEqual(common.formatQueryValue(0, 'foo'), [0, 'foo'])

  const formatString = function(str) {
    return typeof str === 'string' ? str.toLowerCase() : str
  }

  // when stringFormattingFn is passed
  t.deepEqual(common.formatQueryValue('FOO', 'BAZ', formatString), [
    'foo',
    'baz',
  ])
  t.done()
})
