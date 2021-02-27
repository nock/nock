'use strict'

const { expect } = require('chai')
const sinon = require('sinon')
const url = require('url')
const nock = require('..')
const got = require('./got_client')
const assertRejects = require('assert-rejects')

describe('query params in path', () => {
  it('matches that query string', async () => {
    const scope = nock('http://example.test').get('/foo?bar=baz').reply()

    const { statusCode } = await got('http://example.test/foo?bar=baz')

    expect(statusCode).to.equal(200)
    scope.done()
  })
})

describe('`query()`', () => {
  describe('when called with an object', () => {
    it('matches a query string of the same name=value', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .query({ foo: 'bar' })
        .reply()

      const { statusCode } = await got('http://example.test/?foo=bar')

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('matches multiple query strings of the same name=value', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .query({ foo: 'bar', baz: 'foz' })
        .reply()

      const { statusCode } = await got('http://example.test/?foo=bar&baz=foz')

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('matches multiple query strings of the same name=value regardless of order', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .query({ foo: 'bar', baz: 'foz' })
        .reply()

      const { statusCode } = await got('http://example.test/?baz=foz&foo=bar')

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('matches query values regardless of their type of declaration', async () => {
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

    it("doesn't match query values of requests without query string", async () => {
      const scope1 = nock('http://example.test')
        .get('/')
        .query({ num: 1, bool: true, empty: null, str: 'fou' })
        .reply(200, 'scope1')

      const scope2 = nock('http://example.test').get('/').reply(200, 'scope2')

      const { statusCode, body } = await got('http://example.test/')

      expect(statusCode).to.equal(200)
      expect(body).to.equal('scope2')
      scope2.done()
      expect(scope1.isDone()).to.be.false()
    })

    it('matches a query string using regexp', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .query({ foo: /.*/ })
        .reply()

      const { statusCode } = await got('http://example.test/?foo=bar')

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('throws if query params have already been defined', () => {
      const interceptor = nock('http://example.test').get('/?foo=bar')

      expect(() => {
        interceptor.query({ foo: 'baz' })
      }).to.throw(Error, 'Query parameters have already been defined')
    })

    it('throws if it was already called', () => {
      const interceptor = nock('http://example.test')
        .get('/')
        .query({ foo: 'bar' })

      expect(() => {
        interceptor.query({ baz: 'qux' })
      }).to.throw(Error, 'Query parameters have already been defined')
    })

    it('matches a query string that contains special RFC3986 characters', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .query({ 'foo&bar': 'hello&world' })
        .reply()

      const { statusCode } = await got('http://example.test/', {
        searchParams: { 'foo&bar': 'hello&world' },
      })

      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('expects unencoded query params', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .query({ foo: 'hello%20world' })
        .reply()

      await assertRejects(
        got('http://example.test/?foo=hello%20world'),
        /Nock: No match for request/
      )

      const { statusCode } = await got(
        'http://example.test/?foo=hello%2520world'
      )
      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('matches a query string with pre-encoded values', async () => {
      const scope = nock('http://example.test', { encodedQueryParams: true })
        .get('/')
        .query({ foo: 'hello%20world' })
        .reply()

      const { statusCode } = await got('http://example.test/?foo=hello%20world')
      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('when called with "{}" will allow a match against ending in ?', async () => {
      const scope = nock('http://example.test')
        .get('/noquerystring')
        .query({})
        .reply()

      const { statusCode } = await got('http://example.test/noquerystring?')
      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('will not match when a query string does not match name=value', async () => {
      nock('http://example.test').get('/').query({ foo: 'bar' }).reply()

      await assertRejects(
        got('http://example.test/?foo=baz'),
        /Nock: No match for request/
      )
    })

    it('will not match when a query string is present that was not registered', async () => {
      nock('http://example.test').get('/').query({ foo: 'bar' }).reply()

      await assertRejects(
        got('http://example.test/?foo=bar&baz=foz'),
        /Nock: No match for request/
      )
    })

    it('will not match when a query string is malformed', async () => {
      // This is a valid query string so it's not really malformed, just not
      // matching. Should this test be removed?
      nock('http://example.test').get('/').query({ foo: 'bar' }).reply()

      await assertRejects(
        got('http://example.test/?foobar'),
        /Nock: No match for request/
      )
    })

    it('will not match when a query string has fewer correct values than expected', async () => {
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
        /Nock: No match for request/
      )
    })

    it('query matching should not consider request arrays equal to comma-separated expectations', async () => {
      nock('http://example.test').get('/').query({ foo: 'bar,baz' }).reply()

      await assertRejects(
        got('http://example.test?foo[]=bar&foo[]=baz'),
        /Nock: No match for request/
      )
    })

    it('query matching should not consider comma-separated requests equal to array expectations', async () => {
      nock('http://example.test')
        .get('/')
        .query({ foo: ['bar', 'baz'] })
        .reply()

      await assertRejects(
        got('http://example.test?foo=bar%2Cbaz'),
        /Nock: No match for request/
      )
    })
  })

  describe('when called with URLSearchParams', () => {
    it('matches', async () => {
      const params = new url.URLSearchParams({ foo: 'bar' })

      const scope = nock('http://example.test').get('/').query(params).reply()

      const { statusCode } = await got('http://example.test?foo=bar')

      expect(statusCode).to.equal(200)
      scope.done()
    })
  })

  describe('when called with invalid arguments', () => {
    it('throws the expected error', () => {
      const interceptor = nock('http://example.test').get('/')

      expect(() => {
        interceptor.query('foo=bar')
      }).to.throw(Error, 'Argument Error: foo=bar')
    })
  })

  describe('when called with `true`', () => {
    it('will allow all query strings to pass', async () => {
      const scope = nock('http://example.test').get('/').query(true).reply()

      const { statusCode } = await got('http://example.test/?foo=hello%20world')
      expect(statusCode).to.equal(200)
      scope.done()
    })

    it('will match when the path has no query', async () => {
      const scope = nock('http://example.test').get('/').query(true).reply()

      const { statusCode } = await got('http://example.test/')
      expect(statusCode).to.equal(200)
      scope.done()
    })
  })

  describe('when called with a function', () => {
    it('function called with actual queryObject', async () => {
      const queryFn = sinon.stub().returns(true)
      const scope = nock('http://example.test').get('/').query(queryFn).reply()

      const { statusCode } = await got('http://example.test/?foo=bar&a=1&b=2')
      expect(statusCode).to.equal(200)

      expect(queryFn).to.have.been.calledOnceWithExactly({
        foo: 'bar',
        a: '1',
        b: '2',
      })

      scope.done()
    })

    it('function return true the query treat as matched', async () => {
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

    it('function return false the query treat as un-matched', async () => {
      nock('http://example.test')
        .get('/')
        .query(() => false)
        .reply()

      await assertRejects(
        got('http://example.test/?i=should&pass=?'),
        /Nock: No match for request/
      )
    })
  })
})
