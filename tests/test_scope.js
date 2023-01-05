'use strict'

const path = require('path')
const { expect } = require('chai')
const sinon = require('sinon')
const proxyquire = require('proxyquire').preserveCache()
const url = require('url')
const Interceptor = require('../lib/interceptor')
const nock = require('..')
const got = require('./got_client')

it('scope exposes interceptors', () => {
  const scopes = nock.load(
    path.join(__dirname, 'fixtures', 'good_request.json')
  )

  expect(scopes).to.be.an.instanceOf(Array)
  expect(scopes).to.have.lengthOf.at.least(1)

  scopes.forEach(scope => {
    scope.interceptors.forEach(interceptor => {
      expect(interceptor).to.be.an.instanceOf(Interceptor)
      interceptor.delayConnection(100)
    })
  })
})

describe('`Scope#constructor`', () => {
  it('accepts the output of url.parse', async () => {
    const scope = nock(url.parse('http://example.test')).get('/').reply()

    const { statusCode } = await got('http://example.test')
    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('accepts a WHATWG URL instance', async () => {
    const scope = nock(new url.URL('http://example.test')).get('/').reply()

    const { statusCode } = await got('http://example.test')
    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('throws on invalid or omitted protocol', async () => {
    expect(() => nock('ws://example.test')).to.throw()
    expect(() => nock('localhost/foo')).to.throw()
    expect(() => nock('foo.com:1234')).to.throw()
  })

  it('throws on invalid URL format', async () => {
    expect(() => nock(['This is not a url'])).to.throw()
    // The following contains all valid properties of WHATWG URL, but is not an
    // instance of URL. Maybe we should support object literals some day? A
    // simple duck-type validator would suffice.
    expect(() =>
      nock({
        href: 'http://google.com/foo',
        origin: 'http://google.com',
        protocol: 'http:',
        username: '',
        password: '',
        host: 'google.com',
        hostname: 'google.com',
        port: 80,
        pathname: '/foo',
        search: '',
        searchParams: {},
        hash: '',
      })
    ).to.throw()
  })
})

describe('`Scope#remove()`', () => {
  it('removes an active mock', () => {
    const scope = nock('http://example.test').get('/').reply(200)
    const key = 'GET http://example.test:80/'

    // Confidence check.
    expect(scope.activeMocks()).to.deep.equal([key])

    // Act.
    scope.remove(key, scope.interceptors[0])

    // Assert.
    expect(scope.activeMocks()).to.deep.equal([])
  })

  it('when a mock is persisted, does nothing', () => {
    const scope = nock('http://example.test').persist().get('/').reply(200)
    const key = 'GET http://example.test:80/'

    // Confidence check.
    expect(scope.activeMocks()).to.deep.equal([key])

    // Act.
    scope.remove(key, scope.interceptors[0])

    // Assert.
    expect(scope.activeMocks()).to.deep.equal([key])
  })

  it('when the key is nonexistent, does nothing', () => {
    const scope = nock('http://example.test').get('/').reply(200)
    const key = 'GET http://example.test:80/'

    // Confidence check.
    expect(scope.activeMocks()).to.deep.equal([key])

    // Act.
    scope.remove('GET http://bogus.test:80/', scope.interceptors[0])

    // Assert.
    expect(scope.activeMocks()).to.deep.equal([key])
  })
})

it('loadDefs throws expected when fs is not available', () => {
  const { loadDefs } = proxyquire('../lib/scope', { fs: null })

  expect(() => loadDefs()).to.throw(Error, 'No fs')
})

describe('`Scope#isDone()`', () => {
  it('returns false while a mock is pending, and true after it is consumed', async () => {
    const scope = nock('http://example.test').get('/').reply()

    expect(scope.isDone()).to.be.false()

    await got('http://example.test/')

    expect(scope.isDone()).to.be.true()

    scope.done()
  })
})

describe('`filteringPath()`', function () {
  it('filter path with function', async function () {
    const scope = nock('http://example.test')
      .filteringPath(() => '/?a=2&b=1')
      .get('/?a=2&b=1')
      .reply()

    const { statusCode } = await got('http://example.test/', {
      searchParams: { a: '1', b: '2' },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('filter path with regexp', async () => {
    const scope = nock('http://example.test')
      .filteringPath(/\d/g, '3')
      .get('/?a=3&b=3')
      .reply()

    const { statusCode } = await got('http://example.test/', {
      searchParams: { a: '1', b: '2' },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('filteringPath with invalid argument throws expected', () => {
    expect(() => nock('http://example.test').filteringPath('abc123')).to.throw(
      Error,
      'Invalid arguments: filtering path should be a function or a regular expression'
    )
  })
})

describe('filteringRequestBody()', () => {
  it('filter body with function', async () => {
    const onFilteringRequestBody = sinon.spy()

    const scope = nock('http://example.test')
      .filteringRequestBody(body => {
        onFilteringRequestBody()
        expect(body).to.equal('mamma mia')
        return 'mamma tua'
      })
      .post('/', 'mamma tua')
      .reply()

    const { statusCode } = await got.post('http://example.test/', {
      body: 'mamma mia',
    })

    expect(statusCode).to.equal(200)
    expect(onFilteringRequestBody).to.have.been.calledOnce()
    scope.done()
  })

  it('filter body with regexp', async () => {
    const scope = nock('http://example.test')
      .filteringRequestBody(/mia/, 'nostra')
      .post('/', 'mamma nostra')
      .reply(200, 'Hello World!')

    const { statusCode } = await got.post('http://example.test/', {
      body: 'mamma mia',
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('filteringRequestBody with invalid argument throws expected', () => {
    expect(() =>
      nock('http://example.test').filteringRequestBody('abc123')
    ).to.throw(
      Error,
      'Invalid arguments: filtering request body should be a function or a regular expression'
    )
  })
})
