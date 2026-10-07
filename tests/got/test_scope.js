import path from 'node:path'
import { expect } from 'chai'
import sinon from 'sinon'
import { Interceptor } from '../../lib/interceptor.ts'
import nock from '../../index.ts'
import got from './got_client.js'

it('scope exposes interceptors', () => {
  const scopes = nock.load(
    path.join(import.meta.dirname, '..', 'fixtures', 'good_request.json'),
  )

  expect(scopes).to.be.an.instanceOf(Array)
  expect(scopes).to.have.lengthOf.at.least(1)

  scopes.forEach(scope => {
    scope.interceptors.forEach(interceptor => {
      expect(interceptor).to.be.an.instanceOf(Interceptor)
      interceptor.delay(100)
    })
  })
})

describe('`Scope#constructor`', () => {
  it('accepts a WHATWG URL instance', async () => {
    const scope = nock(new URL('http://example.test')).get('/').reply()

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
      'Invalid arguments: filtering path should be a function or a regular expression',
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
      nock('http://example.test').filteringRequestBody('abc123'),
    ).to.throw(
      Error,
      'Invalid arguments: filtering request body should be a function or a regular expression',
    )
  })

  describe('`Scope#clone()`', () => {
    beforeEach(() => nock.disableNetConnect())

    it('creates a new Scope with the same basePath and scope options', () => {
      const scope = nock('http://example.test', { encodedQueryParams: true })
      const clonedScope = scope.clone()

      expect(clonedScope.basePath).to.equal(scope.basePath)
      expect(clonedScope.scopeOptions).to.deep.equal(scope.scopeOptions)
    })

    it('creates a new Scope that works independently', async () => {
      const scope = nock('http://example.test')

      const getScope = scope.get('/').reply(200)
      const postScope = scope.clone().post('/').reply(200)

      await got('http://example.test/')
      expect(getScope.isDone()).to.be.true()

      await got.post('http://example.test/')
      expect(postScope.isDone()).to.be.true()
    })

    const pathCases = [
      ['a string URL', 'http://example.test/api', '/users', '/api/users'],
      [
        'a URL instance',
        new URL('http://example.test/api'),
        '/users',
        '/api/users',
      ],
      ['a trailing slash', 'http://example.test/api/', '/users', '/api/users'],
      [
        'multiple trailing slashes',
        'http://example.test/api//',
        '/users',
        '/api//users',
      ],
      ['an empty interceptor path', 'http://example.test/api', '', '/api'],
      [
        'a slashless interceptor path',
        'http://example.test/api',
        'users',
        '/apiusers',
      ],
      [
        'an encoded path',
        'http://example.test/api%2Fv1',
        '/users',
        '/api%2Fv1/users',
      ],
      ['a root path', 'http://example.test/', '/users', '/users'],
      ['an IPv6 URL', 'http://[::1]:8080/api', '/users', '/api/users'],
      [
        'an IPv6 URL instance',
        new URL('http://[::1]:8080/api'),
        '/users',
        '/api/users',
      ],
      [
        'an HTTPS URL with a port',
        'https://example.test:8443/api',
        '/users',
        '/api/users',
      ],
    ]

    for (const [
      description,
      basePath,
      interceptorPath,
      requestPath,
    ] of pathCases) {
      it(`preserves the base path for ${description}`, async () => {
        const scope = nock(basePath)
        const clonedScope = scope.clone()

        expect(clonedScope.basePath).to.equal(scope.basePath)
        expect(clonedScope.basePathname).to.equal(scope.basePathname)
        clonedScope.get(interceptorPath).reply(200, 'cloned')

        const { body } = await got(`${new URL(basePath).origin}${requestPath}`)

        expect(body).to.equal('cloned')
        clonedScope.done()
      })
    }

    it('preserves a regular expression base path', async () => {
      const basePath = /example\.test/
      const scope = nock(basePath)
      const clonedScope = scope.clone().get('/users').reply(200, 'cloned')

      expect(clonedScope.basePath).to.equal(basePath)

      const { body } = await got('http://example.test/users')

      expect(body).to.equal('cloned')
      clonedScope.done()
    })

    it('does not share interceptors with a scope that has a base path', async () => {
      const scope = nock('http://example.test/api')
        .get('/original')
        .reply(200, 'original')
      const clonedScope = scope.clone()

      expect(clonedScope.interceptors).to.have.lengthOf(0)
      clonedScope.get('/cloned').reply(200, 'cloned')

      const { body } = await got('http://example.test/api/cloned')
      expect(body).to.equal('cloned')
      clonedScope.done()
      expect(scope.isDone()).to.be.false()

      const { body: originalBody } = await got(
        'http://example.test/api/original',
      )
      expect(originalBody).to.equal('original')
      scope.done()
    })
  })
})
