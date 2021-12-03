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
const semver = require('semver')
const nock = require('..')

const common = require('../lib/common')
const matchBody = require('../lib/match_body')

// match_body has its own test file that tests the functionality from the API POV.
// Since it's not in common.js does it make more sense for these six unit tests to move into that file?
describe('Body Match', () => {
  describe('unit', () => {
    it('ignores new line characters from strings', () => {
      const result = matchBody(
        {},
        'something //here is something more \n',
        'something //here is something more \n\r'
      )
      expect(result).to.equal(true)
    })

    it("when spec is a function, it's called with newline characters intact", () => {
      const exampleBody = 'something //here is something more \n'
      const matchCbSpy = sinon.spy()

      matchBody({}, matchCbSpy, exampleBody)
      expect(matchCbSpy).to.have.been.calledOnceWithExactly(exampleBody)
    })

    it('should not throw, when headers come node-fetch style as array', () => {
      const result = matchBody(
        { headers: { 'Content-Type': ['multipart/form-data;'] } },
        {},
        'test'
      )
      expect(result).to.equal(false)
    })

    it("should not ignore new line characters from strings when Content-Type contains 'multipart'", () => {
      const result = matchBody(
        { headers: { 'Content-Type': 'multipart/form-data;' } },
        'something //here is something more \nHello',
        'something //here is something more \nHello'
      )
      expect(result).to.equal(true)
    })

    it("should not ignore new line characters from strings when Content-Type contains 'multipart' (arrays come node-fetch style as array)", () => {
      const result = matchBody(
        { headers: { 'Content-Type': ['multipart/form-data;'] } },
        'something //here is something more \nHello',
        'something //here is something more \nHello'
      )
      expect(result).to.equal(true)
    })

    it('should use strict equality for deep comparisons', () => {
      const result = matchBody({}, { number: 1 }, '{"number": "1"}')
      expect(result).to.equal(false)
    })
  })
})

describe('`normalizeRequestOptions()`', () => {
  it('should normalize hosts with port', () => {
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
  })

  it('should normalize hosts without port', () => {
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
  })

  it('should not error and add defaults for empty options', () => {
    const result = common.normalizeRequestOptions({})

    const expected = {
      host: 'localhost:80',
      // Should this be included?
      // hostname: 'localhost'
      port: 80,
      proto: 'http',
    }

    expect(result).to.deep.equal(expected)
  })
})

describe('`isUtf8Representable()`', () => {
  it("should return false for buffers that aren't utf8 representable", () => {
    expect(common.isUtf8Representable(Buffer.from('8001', 'hex'))).to.equal(
      false
    )
  })

  it('should returns true for buffers containing strings', () => {
    expect(common.isUtf8Representable(Buffer.from('8001', 'utf8'))).to.equal(
      true
    )
  })
})

it('`isJSONContent()`', () => {
  expect(common.isJSONContent({ 'content-type': 'application/json' })).to.equal(
    true
  )

  expect(
    common.isJSONContent({ 'content-type': 'application/json; charset=utf-8' })
  ).to.equal(true)

  expect(common.isJSONContent({ 'content-type': 'text/plain' })).to.equal(false)
})

describe('`headersFieldNamesToLowerCase()`', () => {
  it('should return a lower-cased copy of the input', () => {
    const input = {
      HoSt: 'example.test',
      'Content-typE': 'plain/text',
    }
    const inputClone = { ...input }
    const result = common.headersFieldNamesToLowerCase(input, true)
    const expected = {
      host: 'example.test',
      'content-type': 'plain/text',
    }

    expect(result).to.deep.equal(expected)
    expect(input).to.deep.equal(inputClone) // assert the input is not mutated
  })

  it('throws on conflicting keys', () => {
    expect(() =>
      common.headersFieldNamesToLowerCase(
        {
          HoSt: 'example.test',
          HOST: 'example.test',
        },
        true
      )
    ).to.throw(
      'Failed to convert header keys to lower case due to field name conflict: host'
    )
  })
})

describe('`headersFieldsArrayToLowerCase()`', () => {
  it('should work on arrays', () => {
    // Sort for comparison because order doesn't matter.
    const result = common
      .headersFieldsArrayToLowerCase(['HoSt', 'Content-typE'])
      .sort()

    expect(result).to.deep.equal(['content-type', 'host'])
  })

  it('should de-duplicate arrays', () => {
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
  })
})

describe('`deleteHeadersField()`', () => {
  it('should delete fields with case-insensitive field names', () => {
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
  })

  it('should remove multiple fields with same case-insensitive names', () => {
    const headers = {
      foo: 'one',
      FOO: 'two',
      'X-Foo': 'three',
    }

    common.deleteHeadersField(headers, 'foo')

    expect(headers).to.deep.equal({ 'X-Foo': 'three' })
  })

  it('should throw for invalid headers', () => {
    expect(() => common.deleteHeadersField('foo', 'Content-Type')).to.throw(
      'headers must be an object'
    )
  })

  it('should throw for invalid field name', () => {
    expect(() => common.deleteHeadersField({}, /cookie/)).to.throw(
      'field name must be a string'
    )
  })
})

describe('`matchStringOrRegexp()`', () => {
  it('should match if pattern is string and target matches', () => {
    const result = common.matchStringOrRegexp('to match', 'to match')
    expect(result).to.equal(true)
  })

  it("should not match if pattern is string and target doesn't match", () => {
    const result = common.matchStringOrRegexp('to match', 'not to match')
    expect(result).to.equal(false)
  })

  it('should match pattern is number and target matches', () => {
    const result = common.matchStringOrRegexp(123, 123)
    expect(result).to.equal(true)
  })

  it('should handle undefined target when pattern is string', () => {
    const result = common.matchStringOrRegexp(undefined, 'to not match')
    expect(result).to.equal(false)
  })

  it('should handle undefined target when pattern is regex', () => {
    const result = common.matchStringOrRegexp(undefined, /not/)
    expect(result).to.equal(false)
  })

  it('should match if pattern is regex and target matches', () => {
    const result = common.matchStringOrRegexp('to match', /match/)
    expect(result).to.equal(true)
  })

  it("should not match if pattern is regex and target doesn't match", () => {
    const result = common.matchStringOrRegexp('to match', /not/)
    expect(result).to.equal(false)
  })
})

describe('`overrideRequests()`', () => {
  afterEach(() => {
    common.restoreOverriddenRequests()
  })

  it('should throw if called a second time', () => {
    nock.restore()
    common.overrideRequests()
    // Second call throws.
    expect(() => common.overrideRequests()).to.throw(
      "Module's request already overridden for http protocol."
    )
  })
})

it('`restoreOverriddenRequests()` can be called more than once', () => {
  common.restoreOverriddenRequests()
  common.restoreOverriddenRequests()
})

describe('`stringifyRequest()`', () => {
  it('should include non-default ports', () => {
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
  })

  it('should not include default http port', () => {
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
  })

  it('should not include default https port', () => {
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
  })

  it('should default optional options', () => {
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
  })

  it('should pass headers through', () => {
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
  })

  it('should always treat the body as a string', () => {
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
  })
})

it('`headersArrayToObject()`', () => {
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
})

it('`percentEncode()` encodes extra reserved characters', () => {
  expect(common.percentEncode('foo+(*)!')).to.equal('foo%2B%28%2A%29%21')
})

describe('`normalizeClientRequestArgs()`', () => {
  it('should throw for invalid URL', () => {
    // See https://github.com/nodejs/node/pull/38614 release in node v16.2.0
    const isNewErrorText = semver.gte(process.versions.node, '16.2.0')
    const errorText = isNewErrorText ? 'Invalid URL' : 'example.test'

    // no schema
    expect(() => http.get('example.test')).to.throw(TypeError, errorText)
  })

  it('can include auth info', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .basicAuth({ user: 'user', pass: 'pw' })
      .reply()

    http.get('http://user:pw@example.test')
    scope.isDone()
  })

  it('should handle a single callback', async () => {
    // TODO: Only passing a callback isn't currently supported by Nock,
    // but should be in the future as Node allows it.
    const cb = () => {}

    const { options, callback } = common.normalizeClientRequestArgs(cb)

    expect(options).to.deep.equal({})
    expect(callback).to.equal(cb)
  })
})

describe('`dataEqual()`', () => {
  it('treats explicit and implicit undefined object values as equal', () => {
    const result = common.dataEqual({ a: 'a', b: undefined }, { a: 'a' })
    expect(result).to.equal(true)
  })
  it('does not conflate object and array keys', () => {
    const result = common.dataEqual(['a', 'b'], { 0: 'a', 1: 'b' })
    expect(result).to.equal(false)
  })
  it('treats JSON path notated and nested objects as equal', () => {
    const result = common.dataEqual(
      { 'foo[bar][0]': 'baz' },
      { foo: { bar: ['baz'] } }
    )
    expect(result).to.equal(true)
  })
  it('does not equate arrays of different length', () => {
    const result = common.dataEqual(['a'], ['a', 'b'])
    expect(result).to.equal(false)
  })
})

it('testing timers are deleted correctly', done => {
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
    done()
  })
})
