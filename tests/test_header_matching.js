'use strict'

const http = require('http')
const assertRejects = require('assert-rejects')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

describe('Header matching', () => {
  describe('`Scope.matchHeader()`', () => {
    it('should match headers with function: gets the expected argument', async () => {
      const matchHeaderStub = sinon.stub().returns(true)

      const scope = nock('http://example.test')
        .matchHeader('x-my-headers', matchHeaderStub)
        // `.matchHeader()` is called on the interceptor. It precedes the call to
        // `.get()`.
        .get('/')
        .reply(200, 'Hello World!')

      const { statusCode, body } = await got('http://example.test/', {
        headers: { 'X-My-Headers': 456 },
      })

      // TODO: It's surprising that this function receives a number instead of
      // a string. Probably this behavior should be changed.
      expect(matchHeaderStub).to.have.been.calledOnceWithExactly(456)
      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello World!')
      scope.done()
    })

    it('should not match headers with function: does not match when match declined', async () => {
      nock('http://example.test')
        .matchHeader('x-my-headers', () => false)
        // `.matchHeader()` is called on the interceptor. It precedes the call to
        // `.get()`.
        .get('/')
        .reply(200, 'Hello World!')

      await assertRejects(
        got('http://example.test/', {
          headers: { 'X-My-Headers': 456 },
        }),
        /Nock: No match for request/
      )
    })

    it('should not consume mock request when match is declined by function', async () => {
      const scope = nock('http://example.test')
        .matchHeader('x-my-headers', () => false)
        // `.matchHeader()` is called on the interceptor. It precedes the call to
        // `.get()`.
        .get('/')
        .reply(200, 'Hello World!')

      await assertRejects(
        got('http://example.test/', {
          headers: { '-My-Headers': 456 },
        }),
        /Nock: No match for request/
      )

      expect(scope.isDone()).to.be.false()
    })

    it('should match headers on all Interceptors created from Scope', async () => {
      const scope = nock('http://example.test')
        .matchHeader('accept', 'application/json')
        .get('/one')
        .reply(200, { hello: 'world' })
        .get('/two')
        .reply(200, { a: 1, b: 2, c: 3 })

      const response1 = await got('http://example.test/one', {
        headers: { Accept: 'application/json' },
      })

      expect(response1.statusCode).to.equal(200)
      expect(response1.body).to.equal('{"hello":"world"}')

      const response2 = await got('http://example.test/two', {
        headers: { Accept: 'application/json' },
      })
      expect(response2.statusCode).to.equal(200)
      expect(response2.body).to.equal('{"a":1,"b":2,"c":3}')

      scope.done()
    })
  })

  describe('`Interceptor.matchHeader()`', () => {
    it('should match a simple header', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', 'My custom Header value')
        .reply(200, 'Hello World!')

      const { statusCode, body } = await got('http://example.test/', {
        headers: { 'X-My-Headers': 'My custom Header value' },
      })

      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello World!')
      scope.done()
    })

    // https://github.com/nock/nock/issues/399
    // https://github.com/nock/nock/issues/822
    it('should match headers coming in as an array', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', 'My custom Header value')
        .reply()

      const { statusCode } = await got('http://example.test/', {
        headers: { 'X-My-Headers': ['My custom Header value'] },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('should match multiple headers', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', 'My custom Header value')
        .reply(200, 'Hello World!')
        .get('/')
        .matchHeader('x-my-headers', 'other value')
        .reply(200, 'Hello World other value!')

      const response1 = await got('http://example.test/', {
        headers: { 'X-My-Headers': 'other value' },
      })

      expect(response1.statusCode).to.equal(200)
      expect(response1.body).to.equal('Hello World other value!')

      const response2 = await got('http://example.test/', {
        headers: { 'X-My-Headers': 'My custom Header value' },
      })

      expect(response2.statusCode).to.equal(200)
      expect(response2.body).to.equal('Hello World!')

      scope.done()
    })

    it('should match headers with regexp', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', /My He.d.r [0-9.]+/)
        .reply(200, 'Hello World!')

      const { statusCode, body } = await got('http://example.test/', {
        headers: { 'X-My-Headers': 'My Header 1.0' },
      })

      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello World!')
      scope.done()
    })

    it('should match headers provided as numbers with regexp', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', /\d+/)
        .reply(200, 'Hello World!')

      const { statusCode, body } = await got('http://example.test/', {
        headers: { 'X-My-Headers': 123 },
      })

      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello World!')
      scope.done()
    })

    it('should match headers with function that gets the expected argument', async () => {
      const matchHeaderStub = sinon.stub().returns(true)

      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', matchHeaderStub)
        .reply(200, 'Hello World!')

      const { statusCode, body } = await got('http://example.test/', {
        headers: { 'X-My-Headers': 456 },
      })

      // TODO: It's surprising that this function receives a number instead of
      // a string. Probably this behavior should be changed.
      expect(matchHeaderStub).to.have.been.calledOnceWithExactly(456)
      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello World!')
      scope.done()
    })

    it('should match headers with function and allow unmocked: matches when match accepted', async () => {
      const scope = nock('http://example.test', { allowUnmocked: true })
        .get('/')
        .matchHeader('x-my-headers', () => true)
        .reply(200, 'Hello World!')

      const { statusCode, body } = await got('http://example.test/', {
        headers: { 'X-My-Headers': 456 },
      })

      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello World!')
      scope.done()
    })

    it('should not match headers with function: does not match when match declined', async () => {
      nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', () => false)
        .reply(200, 'Hello World!')

      await assertRejects(
        got('http://example.test/', {
          headers: { 'X-My-Headers': 456 },
        }),
        /Nock: No match for request/
      )
    })

    it('should not consume mock request when match is declined by function', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('x-my-headers', () => false)
        .reply(200, 'Hello World!')

      await assertRejects(
        got('http://example.test/', {
          headers: { '-My-Headers': 456 },
        }),
        /Nock: No match for request/
      )

      expect(scope.isDone()).to.be.false()
    })

    it('should match basic authentication header', async () => {
      const username = 'testuser'
      const password = 'testpassword'
      const authString = Buffer.from(`${username}:${password}`).toString(
        'base64'
      )
      const expectedAuthHeader = `Basic ${authString}`

      const scope = nock('http://example.test')
        .get('/')
        .matchHeader('Authorization', val => val === expectedAuthHeader)
        .reply(200, 'Hello World!')

      const { statusCode, body } = await got('http://example.test/', {
        username,
        password,
      })

      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello World!')
      scope.done()
    })
  })

  describe('`Scope#reqheaders`', () => {
    it('should fail when specified request header is missing', async () => {
      nock('http://example.test', {
        reqheaders: {
          'X-App-Token': 'apptoken',
          'X-Auth-Token': 'apptoken',
        },
      })
        .post('/')
        .reply(200, { status: 'ok' })

      await assertRejects(
        got.post('http://example.test/', {
          headers: { 'X-App-Token': 'apptoken' },
        }),
        /Nock: No match for request/
      )
    })

    it('should match when request header matches regular expression', async () => {
      const scope = nock('http://example.test', {
        reqheaders: { 'X-My-Super-Power': /.+/ },
      })
        .post('/')
        .reply()

      const { statusCode } = await got.post('http://example.test/', {
        headers: { 'X-My-Super-Power': 'mullet growing' },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('should not match when request header does not match regular expression', async () => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'X-My-Super-Power': /Mullet.+/,
        },
      })
        .post('/')
        .reply()

      await assertRejects(
        got.post('http://example.test/', {
          headers: { 'X-My-Super-Power': 'mullet growing' },
        }),
        /Nock: No match/
      )

      expect(scope.isDone()).to.be.false()
    })

    // https://github.com/nock/nock/issues/399
    // https://github.com/nock/nock/issues/822
    it('should match when headers are coming in as an array', async () => {
      const scope = nock('http://example.test', {
        reqheaders: { 'x-my-headers': 'My custom Header value' },
      })
        .get('/')
        .reply()

      const { statusCode } = await got('http://example.test/', {
        headers: { 'X-My-Headers': ['My custom Header value'] },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('should throw if reqheaders are not an object', async () => {
      const options = {
        reqheaders: 'Content-Type: text/plain',
      }

      expect(() => nock('http://example.test', options).get('/')).to.throw(
        'Headers must be provided as an object'
      )
    })

    it('should matche when request header satisfies the header function', async () => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'X-My-Super-Power': value => value === 'mullet growing',
        },
      })
        .post('/')
        .reply()

      const { statusCode } = await got.post('http://example.test/', {
        headers: { 'X-My-Super-Power': 'mullet growing' },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('should not match when request header does not satisfy the header function', async () => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'X-My-Super-Power': value => value === 'Mullet Growing',
        },
      })
        .post('/')
        .reply()

      await assertRejects(
        got.post('http://example.test/', {
          headers: { 'X-My-Super-Power': 'mullet growing' },
        }),
        /Nock: No match/
      )

      expect(scope.isDone()).to.be.false()
    })

    it('should not fail when specified request header is not missing', async () => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'X-App-Token': 'apptoken',
          'X-Auth-Token': 'apptoken',
        },
      })
        .post('/')
        .reply()

      const { statusCode } = await got.post('http://example.test/', {
        headers: {
          'X-App-Token': 'apptoken',
          'X-Auth-Token': 'apptoken',
        },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('should be case insensitive', async () => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'x-app-token': 'apptoken',
          'x-auth-token': 'apptoken',
        },
      })
        .post('/')
        .reply()

      const { statusCode } = await got.post('http://example.test/', {
        headers: {
          'X-App-TOKEN': 'apptoken',
          'X-Auth-TOKEN': 'apptoken',
        },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('should only match the last duplicate request header', done => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'x-auth-token': 'biz',
        },
      })
        .get('/')
        .reply()

      // Can't use Got here because it would change these headers
      const req = http.get('http://example.test', {
        headers: {
          'x-auth-token': 'foo',
          'X-Auth-Token': 'bar',
          'X-AUTH-TOKEN': 'biz',
        },
      })

      req.on('response', res => {
        expect(res.statusCode).to.equal(200)
        scope.done()
        done()
      })
    })

    // https://github.com/nock/nock/issues/966
    it('mocking succeeds when mocked and specified request headers have falsy values', async () => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'x-foo': 0,
        },
      })
        .post('/')
        .reply()

      const { statusCode } = await got.post('http://example.test/', {
        headers: {
          'X-Foo': 0,
        },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('multiple interceptors override headers from unrelated request', async () => {
      nock.define([
        {
          scope: 'https://example.test:443',
          method: 'get',
          path: '/bar',
          reqheaders: {
            'x-foo': 'bar',
          },
          status: 200,
          response: {},
        },
        {
          scope: 'https://example.test:443',
          method: 'get',
          path: '/baz',
          reqheaders: {
            'x-foo': 'baz',
          },
          status: 200,
          response: {},
        },
      ])

      const res1 = await got('https://example.test/bar', {
        headers: { 'x-foo': 'bar' },
      })
      expect(res1.statusCode).to.equal(200)

      const res2 = await got('https://example.test/baz', {
        headers: { 'x-foo': 'baz' },
      })
      expect(res2.statusCode).to.equal(200)
    })
  })

  describe('`Scope#badheaders`', () => {
    it('should prevent match when badheaders are present', async () => {
      const scope = nock('http://example.test', {
        badheaders: ['cookie'],
      })
        .get('/')
        .reply()

      await assertRejects(
        got('http://example.test/', {
          headers: { Cookie: 'cookie', Donut: 'donut' },
        }),
        /Nock: No match for request/
      )

      expect(scope.isDone()).to.be.false()
    })

    it('should not prevent match when badheaders are absent but other headers are present', async () => {
      const scope = nock('http://example.test', {
        badheaders: ['cookie'],
      })
        .get('/')
        .reply()

      await got('http://example.test/', { headers: { Donut: 'donut' } })

      scope.done()
    })
  })

  describe('Host header handling', () => {
    // The next three tests cover the special case for the Host header where it's only used for
    // matching if it's defined on the scope and the request. See https://github.com/nock/nock/pull/196
    it('Host header is used for matching if defined on the scope and request', async () => {
      const scope = nock('http://example.test', {
        reqheaders: { host: 'example.test' },
      })
        .get('/')
        .reply()

      const { statusCode } = await got('http://example.test/', {
        headers: { Host: 'example.test' },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('Host header is ignored during matching if not defined on the request', async () => {
      const scope = nock('http://example.test', {
        reqheaders: { host: 'some.other.domain.test' },
      })
        .get('/')
        .reply()

      const { statusCode } = await got('http://example.test/')

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('Host header is used to reject a match if defined on the scope and request', async () => {
      nock('http://example.test', {
        reqheaders: { host: 'example.test' },
      })
        .get('/')
        .reply()

      await assertRejects(
        got('http://example.test/', {
          headers: { Host: 'some.other.domain.test' },
        }),
        /Nock: No match for request/
      )
    })
  })
})

it('header manipulation', done => {
  // This test seems to depend on behavior of the `http` module.
  const scope = nock('http://example.test')
    .get('/accounts')
    .reply(200, { accounts: [{ id: 1, name: 'Joe Blow' }] })

  const req = http.request({ host: 'example.test', path: '/accounts' }, res => {
    res.on('end', () => {
      scope.done()
      done()
    })
    // Streams start in 'paused' mode and must be started.
    // See https://nodejs.org/api/stream.html#stream_class_stream_readable
    res.resume()
  })

  req.setHeader('X-Custom-Header', 'My Value')
  expect(req.getHeader('X-Custom-Header')).to.equal('My Value')

  req.removeHeader('X-Custom-Header')
  expect(req.getHeader('X-Custom-Header')).to.be.undefined()

  req.end()
})
