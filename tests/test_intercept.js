'use strict'

const http = require('http')
const https = require('https')
const { expect } = require('chai')
const sinon = require('sinon')
const assertRejects = require('assert-rejects')
const url = require('url')
const nock = require('..')
const got = require('./got_client')

const acceptableGlobalKeys = new Set([
  ...Object.keys(global),
  '_key',
  '__core-js_shared__',
  'fetch',
  'Response',
  'Headers',
  'Request',
])

describe('Intercept', () => {
  it('invalid or missing method parameter throws an exception', () => {
    expect(() => nock('https://example.test').intercept('/somepath')).to.throw(
      'The "method" parameter is required for an intercept call.'
    )
  })

  it("should throw when the path doesn't include a leading slash and there is no base path", () => {
    expect(() => nock('http://example.test').get('no-leading-slash')).to.throw(
      "Non-wildcard URL path strings must begin with a slash (otherwise they won't match anything)"
    )
  })

  // https://github.com/nock/nock/issues/1730
  it('should throw when the path is empty and there is no base path', () => {
    expect(() => nock('http://example.test').get('')).to.throw(
      "Non-wildcard URL path strings must begin with a slash (otherwise they won't match anything) (got: )"
    )
  })

  it('should intercept a basic GET request', async () => {
    const scope = nock('http://example.test').get('/').reply(201)

    const { statusCode } = await got('http://example.test/')

    expect(statusCode).to.equal(201)
    scope.done()
  })

  it('should intercept a request with a base path', async () => {
    const scope = nock('http://example.test/abc').get('/def').reply(201)

    const { statusCode } = await got('http://example.test/abc/def')

    expect(statusCode).to.equal(201)
    scope.done()
  })

  it('should intercept a request with a base path and no interceptor path', async () => {
    const scope = nock('http://example.test/abc').get('').reply(201)

    const { statusCode } = await got('http://example.test/abc')

    expect(statusCode).to.equal(201)
    scope.done()
  })

  it('should intercept a request with a base path and an interceptor path without a leading slash', async () => {
    const scope = nock('http://example.test/abc').get('def').reply(201)

    const { statusCode } = await got('http://example.test/abcdef')

    expect(statusCode).to.equal(201)
    scope.done()
  })

  it('should intercept a basic POST request', async () => {
    const scope = nock('http://example.test').post('/form').reply(201, 'OK!')

    const { statusCode, body } = await got.post('http://example.test/form', {
      responseType: 'buffer',
    })

    expect(statusCode).to.equal(201)
    expect(body).to.be.an.instanceOf(Buffer)
    expect(body.toString('utf8')).to.equal('OK!')
    scope.done()
  })

  it('post with empty response body', async () => {
    const scope = nock('http://example.test').post('/form').reply()

    const { statusCode, body } = await got.post('http://example.test/form', {
      responseType: 'buffer',
    })

    expect(statusCode).to.equal(200)
    expect(body).to.be.an.instanceOf(Buffer)
    expect(body).to.have.lengthOf(0)
    scope.done()
  })

  it('post, lowercase', done => {
    const onData = sinon.spy()

    const scope = nock('http://example.test').post('/form').reply(200, 'OK!')

    // Since this is testing a lowercase `method`, it's using the `http` module.
    const req = http.request(
      {
        host: 'example.test',
        method: 'post',
        path: '/form',
        port: 80,
      },
      res => {
        expect(res.statusCode).to.equal(200)
        res.on('data', data => {
          onData()
          expect(data).to.be.an.instanceOf(Buffer)
          expect(data.toString()).to.equal('OK!')
        })
        res.on('end', () => {
          expect(onData).to.have.been.calledOnce()
          scope.done()
          done()
        })
      }
    )

    req.end()
  })

  it('post with regexp as spec', async () => {
    const input = 'key=val'

    const scope = nock('http://example.test')
      .post('/echo', /key=v.?l/g)
      .reply(200, (uri, body) => ['OK', uri, body].join(' '))

    const { body } = await got.post('http://example.test/echo', { body: input })

    expect(body).to.equal('OK /echo key=val')
    scope.done()
  })

  it('post with function as spec', async () => {
    const scope = nock('http://example.test')
      .post('/echo', body => body === 'key=val')
      .reply(200, (uri, body) => ['OK', uri, body].join(' '))

    const { body } = await got.post('http://example.test/echo', {
      body: 'key=val',
    })

    expect(body).to.equal('OK /echo key=val')
    scope.done()
  })

  it('post with chaining on call', async () => {
    const input = 'key=val'

    const scope = nock('http://example.test')
      .post('/echo', input)
      .reply(200, (uri, body) => ['OK', uri, body].join(' '))

    const { body } = await got.post('http://example.test/echo', { body: input })

    expect(body).to.equal('OK /echo key=val')
    scope.done()
  })

  it('should intercept a basic DELETE request', async () => {
    const scope = nock('https://example.test').delete('/').reply(204)

    const { statusCode } = await got.delete('https://example.test')

    expect(statusCode).to.equal(204)
    scope.done()
  })

  // Not sure what is the intent of this test.
  it('reply with callback and filtered path and body', async () => {
    const scope = nock('http://example.test')
      .filteringPath(/.*/, '*')
      .filteringRequestBody(/.*/, '*')
      .post('*', '*')
      .reply(200, (uri, body) => ['OK', uri, body].join(' '))

    const { body } = await got.post('http://example.test/original/path', {
      body: 'original=body',
    })

    expect(body).to.equal('OK /original/path original=body')
    scope.done()
  })

  it('should intercept a basic HEAD request', async () => {
    const scope = nock('http://example.test').head('/').reply(201, 'OK!')

    const { statusCode } = await got.head('http://example.test/')

    expect(statusCode).to.equal(201)
    scope.done()
  })

  it('body data is differentiating', async () => {
    const scope = nock('http://example.test')
      .post('/', 'abc')
      .reply(200, 'Hey 1')
      .post('/', 'def')
      .reply(200, 'Hey 2')

    const response1 = await got.post('http://example.test/', { body: 'abc' })
    expect(response1).to.include({ statusCode: 200, body: 'Hey 1' })

    const response2 = await got.post('http://example.test/', { body: 'def' })
    expect(response2).to.include({ statusCode: 200, body: 'Hey 2' })

    scope.done()
  })

  it('chaining', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')
      .post('/form')
      .reply(201, 'OK!')

    const response1 = await got.post('http://example.test/form')
    expect(response1).to.include({ statusCode: 201, body: 'OK!' })

    const response2 = await got('http://example.test/')
    expect(response2).to.include({ statusCode: 200, body: 'Hello World!' })

    scope.done()
  })

  it('encoding', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    const { body } = await got('http://example.test/', { encoding: 'base64' })

    expect(body).to.be.a('string').and.equal('SGVsbG8gV29ybGQh')

    scope.done()
  })

  it('on interceptor, filter path with function', async () => {
    // Interceptor.filteringPath simply proxies to Scope.filteringPath, this test covers the proxy,
    // testing the logic of filteringPath itself is done in test_scope.js.
    const scope = nock('http://example.test')
      .get('/?a=2&b=1')
      .filteringPath(() => '/?a=2&b=1')
      .reply(200, 'Hello World!')

    const { statusCode } = await got('http://example.test/', {
      searchParams: { a: '1', b: '2' },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('chaining API', async () => {
    const scope = nock('http://example.test')
      .get('/one')
      .reply(200, 'first one')
      .get('/two')
      .reply(200, 'second one')

    const response1 = await got('http://example.test/one')
    expect(response1).to.include({ statusCode: 200, body: 'first one' })

    const response2 = await got('http://example.test/two')
    expect(response2).to.include({ statusCode: 200, body: 'second one' })

    scope.done()
  })

  it('same URI', async () => {
    const scope = nock('http://example.test')
      .get('/abc')
      .reply(200, 'first one')
      .get('/abc')
      .reply(201, 'second one')

    const response1 = await got('http://example.test/abc')
    expect(response1).to.include({ statusCode: 200, body: 'first one' })

    const response2 = await got('http://example.test/abc')
    expect(response2).to.include({ statusCode: 201, body: 'second one' })

    scope.done()
  })

  // TODO Should this test be kept?
  it('can use hostname instead of host', done => {
    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    const req = http.request(
      {
        hostname: 'example.test',
        path: '/',
      },
      res => {
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.end()
  })

  it('hostname is case insensitive', done => {
    const scope = nock('http://example.test').get('/path').reply()

    const req = http.request(
      {
        hostname: 'EXAMPLE.test',
        path: '/path',
        method: 'GET',
      },
      () => {
        scope.done()
        done()
      }
    )
    req.end()
  })

  it('can take a port', async () => {
    const scope = nock('http://example.test:3333').get('/').reply()

    const { statusCode } = await got('http://example.test:3333/')

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('can use https', async () => {
    const scope = nock('https://example.test').get('/').reply()

    const { statusCode } = await got('https://example.test/', {
      responseType: 'buffer',
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('emits error when listeners are added after `req.end()` call', done => {
    nock('http://example.test').get('/').reply()

    const req = http.request(
      {
        host: 'example.test',
        path: '/wrong-path',
      },
      res => {
        expect.fail(new Error('should not come here!'))
      }
    )

    req.end()

    req.on('error', err => {
      expect(err.message.trim()).to.equal(
        `Nock: No match for request ${JSON.stringify(
          {
            method: 'GET',
            url: 'http://example.test/wrong-path',
            headers: {},
          },
          null,
          2
        )}`
      )
      done()
    })
  })

  it('emits error if https route is missing', done => {
    nock('https://example.test').get('/').reply(200, 'Hello World!')

    const req = https.request(
      {
        host: 'example.test',
        path: '/abcdef892932',
      },
      res => {
        expect.fail(new Error('should not come here!'))
      }
    )
    req.on('error', err => {
      expect(err.message.trim()).to.equal(
        `Nock: No match for request ${JSON.stringify(
          {
            method: 'GET',
            url: 'https://example.test/abcdef892932',
            headers: {},
          },
          null,
          2
        )}`
      )
      done()
    })
    req.end()
  })

  it('emits error if https route is missing, non-standard port', done => {
    nock('https://example.test:123').get('/').reply(200, 'Hello World!')

    const req = https.request(
      {
        host: 'example.test',
        port: 123,
        path: '/dsadsads',
      },
      res => {
        expect.fail(new Error('should not come here!'))
      }
    )

    req.on('error', err => {
      expect(err.message.trim()).to.equal(
        `Nock: No match for request ${JSON.stringify(
          {
            method: 'GET',
            url: 'https://example.test:123/dsadsads',
            headers: {},
          },
          null,
          2
        )}`
      )
      done()
    })
    req.end()
  })

  it('scopes are independent', async () => {
    const scope1 = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')
    const scope2 = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    await got('http://example.test/')

    expect(scope1.isDone()).to.be.true()
    expect(scope2.isDone()).to.be.false()
  })

  it('two scopes with the same request are consumed', async () => {
    const scope1 = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    const scope2 = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    await got('http://example.test/')
    await got('http://example.test/')

    scope1.done()
    scope2.done()
  })

  // TODO: Move this test to test_header_matching.
  it('username and password works', done => {
    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Welcome, username')

    http
      .request(
        {
          hostname: 'example.test',
          auth: 'username:password',
          path: '/',
        },
        res => {
          scope.done()
          done()
        }
      )
      .end()
  })

  it('Matches with a username and password in the URL', async () => {
    const scope = nock('http://example.test')
      .get('/abc')
      .reply(function () {
        // TODO Investigate why we don't get an authorization header.
        // expect(this.req.headers).to.include({ Authorization: 'foobar' })
        return [200]
      })

    const { statusCode } = await got(
      'http://username:password@example.test/abc'
    )
    expect(statusCode).to.equal(200)

    scope.done()
  })

  it('different port works', done => {
    const scope = nock('http://example.test:8081').get('/').reply()

    http
      .request(
        {
          hostname: 'example.test',
          port: 8081,
          path: '/',
        },
        res => {
          scope.done()
          done()
        }
      )
      .end()
  })

  it('explicitly specifiying port 80 works', done => {
    const scope = nock('http://example.test:80').get('/').reply()

    http
      .request(
        {
          hostname: 'example.test',
          port: 80,
          path: '/',
        },
        res => {
          scope.done()
          done()
        }
      )
      .end()
  })

  it('post with object', done => {
    const scope = nock('http://example.test')
      .post('/claim', { some_data: 'something' })
      .reply()

    http
      .request(
        {
          hostname: 'example.test',
          port: 80,
          method: 'POST',
          path: '/claim',
        },
        res => {
          scope.done()
          done()
        }
      )
      .end('{"some_data":"something"}')
  })

  it('accept string as request target', done => {
    const responseBody = 'Hello World!'
    const onData = sinon.spy()
    const scope = nock('http://example.test').get('/').reply(200, responseBody)

    http.get('http://example.test', res => {
      expect(res.statusCode).to.equal(200)

      res.on('data', data => {
        onData()
        expect(data).to.be.an.instanceOf(Buffer)
        expect(data.toString()).to.equal(responseBody)
      })

      res.on('end', () => {
        expect(onData).to.have.been.calledOnce()
        scope.done()
        done()
      })
    })
  })

  it('sending binary and receiving JSON should work', async () => {
    const scope = nock('http://example.test')
      .post('/')
      .reply(201, { foo: '61' }, { 'Content-Type': 'application/json' })

    const { statusCode, body } = await got.post('http://example.test/', {
      // This is an encoded JPEG.
      body: Buffer.from('ffd8ffe000104a46494600010101006000600000ff', 'hex'),
      headers: { Accept: 'application/json', 'Content-Length': 23861 },
    })
    expect(statusCode).to.equal(201)
    expect(body).to.be.a('string').and.have.lengthOf(12)
    expect(JSON.parse(body)).to.deep.equal({ foo: '61' })
    scope.done()
  })

  it('do not match when conditionally = false but should match after trying again when = true', async () => {
    let enabled = false

    const scope = nock('http://example.test', { conditionally: () => enabled })
      .get('/')
      .reply(200)

    await assertRejects(
      got('http://example.test/'),
      /Nock: No match for request/
    )
    expect(scope.isDone()).to.be.false()

    enabled = true

    const { statusCode } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    scope.done()
  })

  // TODO: Try to convert to async/got.
  it('get correct filtering with scope and request headers filtering', done => {
    const responseText = 'OK!'
    const requestHeaders = { host: 'foo.example.test' }

    const scope = nock('http://foo.example.test', {
      filteringScope: scope => /^http:\/\/.*\.example\.test/.test(scope),
    })
      .get('/path')
      .reply(200, responseText, { 'Content-Type': 'text/plain' })

    const onData = sinon.spy()
    const req = http.get('http://bar.example.test/path', res => {
      expect(req.getHeaders()).to.deep.equal({ host: requestHeaders.host })

      res.on('data', data => {
        onData()
        expect(data.toString()).to.equal(responseText)
      })
      res.on('end', () => {
        expect(onData).to.have.been.calledOnce()
        scope.done()
        done()
      })
    })
  })

  it('different subdomain with reply callback and filtering scope', async () => {
    const responseText = 'OK!'
    // We scope for www.example.test but through scope filtering we will accept
    // any <subdomain>.example.test.
    const scope = nock('http://example.test', {
      filteringScope: scope => /^http:\/\/.*\.example/.test(scope),
    })
      .get('/')
      .reply(200, () => responseText)

    const { body } = await got('http://a.example.test')
    expect(body).to.equal(responseText)
    scope.done()
  })

  it('succeeds even when host request header is not specified', done => {
    const scope = nock('http://example.test').post('/resource').reply()

    const opts = {
      method: 'POST',
      headers: {
        'X-App-TOKEN': 'apptoken',
        'X-Auth-TOKEN': 'apptoken',
      },
    }

    const req = http.request('http://example.test/resource', opts, res => {
      res.on('end', () => {
        scope.done()
        done()
      })
      res.resume()
    })

    req.end()
  })

  // https://github.com/nock/nock/issues/158
  // mikeal/request with strictSSL: true
  // https://github.com/request/request/blob/3c0cddc7c8eb60b470e9519da85896ed7ee0081e/request.js#L943-L950
  it('should denote the response client is authorized for HTTPS requests', done => {
    const scope = nock('https://example.test').get('/what').reply()

    https.get('https://example.test/what', res => {
      expect(res).to.have.nested.property('socket.authorized').that.is.true()

      res.on('end', () => {
        scope.done()
        done()
      })
      res.resume()
    })
  })

  it('match domain using regexp', async () => {
    const scope = nock(/regexexample\.test/)
      .get('/resources')
      .reply()

    const { statusCode } = await got('http://regexexample.test/resources')
    expect(statusCode).to.equal(200)
    scope.done()
  })

  // https://github.com/nock/nock/issues/1137
  it('match domain using regexp with path as callback', async () => {
    const scope = nock(/.*/)
      .get(() => true)
      .reply(200, 'Match regex')

    const { statusCode } = await got('http://example.test/resources')
    expect(statusCode).to.equal(200)
    scope.done()
  })

  // https://github.com/nock/nock/issues/508
  it('match multiple interceptors with regexp domain', async () => {
    nock(/chainregex/)
      .get('/')
      .reply(200, 'Match regex')
      .get('/')
      .reply(500, 'Match second intercept')

    const response1 = await got('http://chainregex.test/')
    expect(response1).to.include({ statusCode: 200, body: 'Match regex' })

    const response2 = await got('http://chainregex.test/', {
      throwHttpErrors: false,
    })
    expect(response2).to.include({
      statusCode: 500,
      body: 'Match second intercept',
    })
  })

  it('interceptors should work in any order', async () => {
    nock('http://some.test')
      .get('/path1?query=1')
      .reply(200, 'response for path1/query1')
      .get('/path2?query=2')
      .reply(200, 'response for path2/query2')

    // Calling second request before first
    const response2 = await got('http://some.test/path2?query=2')
    expect(response2).to.include({
      statusCode: 200,
      body: 'response for path2/query2',
    })

    // Calling first request after second
    const response1 = await got('http://some.test/path1?query=1')
    expect(response1).to.include({
      statusCode: 200,
      body: 'response for path1/query1',
    })
  })

  it('interceptors should work in any order with filteringScope', async () => {
    nock('http://some.test', {
      filteringScope: scope => true,
    })
      .get('/path1?query=1')
      .reply(200, 'response for path1/query1')
      .get('/path2?query=2')
      .reply(200, 'response for path2/query2')

    // Calling second request before first
    const response2 = await got('http://other.test/path2?query=2')
    expect(response2).to.include({
      statusCode: 200,
      body: 'response for path2/query2',
    })

    // Calling first request after second
    const response1 = await got('http://other.test/path1?query=1')
    expect(response1).to.include({
      statusCode: 200,
      body: 'response for path1/query1',
    })
  })

  // FIXME: This marked as `skip` because it is an existing bug.
  // https://github.com/nock/nock/issues/1108
  it.skip('match hostname as regex and string in tandem', async () => {
    const scope1 = nock(/.*/).get('/hello/world').reply()
    const scope2 = nock('http://example.test').get('/hello/planet').reply()

    const response1 = await got('http://example.test/hello/world')
    expect(response1.statusCode).to.equal(200)
    scope1.done()

    const response2 = await got('http://example.test/hello/planet')
    expect(response2.statusCode).to.equal(200)
    scope2.done()
  })

  it('match domain using intercept callback', async () => {
    const validUrl = ['/cats', '/dogs']

    nock('http://example.test')
      .get(function (uri) {
        return validUrl.indexOf(uri) >= 0
      })
      .reply(200, 'Match intercept')
      .get('/cats')
      .reply(200, 'Match intercept 2')

    const response1 = await got('http://example.test/cats')
    expect(response1).to.include({ statusCode: 200, body: 'Match intercept' })

    const response2 = await got('http://example.test/cats')
    expect(response2).to.include({ statusCode: 200, body: 'Match intercept 2' })
  })

  it('match path using regexp', async () => {
    nock('http://example.test')
      .get(/regex$/)
      .reply(200, 'Match regex')

    const { statusCode, body } = await got(
      'http://example.test/resources/regex'
    )
    expect(statusCode).to.equal(200)
    expect(body).to.equal('Match regex')
  })

  // https://github.com/nock/nock/issues/2134
  it('match path using regexp with global flag', async () => {
    nock('http://example.test').get(/foo/g).reply(200, 'Match regex')

    const { statusCode, body } = await got('http://example.test/foo/bar')
    expect(statusCode).to.equal(200)
    expect(body).to.equal('Match regex')
  })

  it('match path using function', async () => {
    const path = '/match/uri/function'
    const urlFunction = uri => uri === path

    nock(`http://example.test`)
      .delete(urlFunction)
      .reply(200, 'Match DELETE')
      .get(urlFunction)
      .reply(200, 'Match GET')
      .head(urlFunction)
      .reply(200, 'Match HEAD')
      .merge(urlFunction)
      .reply(200, 'Match MERGE')
      .options(urlFunction)
      .reply(200, 'Match OPTIONS')
      .patch(urlFunction)
      .reply(200, 'Match PATCH')
      .post(urlFunction)
      .reply(200, 'Match POST')
      .put(urlFunction)
      .reply(200, 'Match PUT')

    const postResponse = await got.post(
      'http://example.test/match/uri/function'
    )
    expect(postResponse).to.include({ statusCode: 200, body: `Match POST` })

    const getResponse = await got('http://example.test/match/uri/function')
    expect(getResponse).to.include({ statusCode: 200, body: `Match GET` })

    await assertRejects(
      got.head('http://example.test/do/not/match'),
      /Nock: No match for request/
    )
  })

  it('you must setup an interceptor for each request', async () => {
    nock('http://example.test').get('/hey').reply(200, 'First match')

    const { statusCode, body } = await got('http://example.test/hey')
    expect(statusCode).to.equal(200)
    expect(body).to.equal('First match')

    await assertRejects(
      got('http://example.test/hey'),
      /Nock: No match for request/
    )
  })

  // TODO: What is the intention of this test?
  it('no content type provided', done => {
    const scope = nock('http://example.test')
      .replyContentLength()
      .post('/httppost', () => true)
      .reply(401, '')

    http
      .request(
        {
          host: 'example.test',
          path: '/httppost',
          method: 'POST',
          headers: {},
        },
        res => {
          res.on('data', () => {})
          res.once('end', () => {
            scope.done()
            done()
          })
        }
      )
      .end('WHAA')
  })

  // https://github.com/nock/nock/issues/835
  it('match domain and path using regexp', async () => {
    const responseBody = 'this is the response'
    const scope = nock(/example/)
      .get(/img/)
      .reply(200, responseBody)

    const { statusCode, body } = await got('http://example.test/imghp?hl=en')
    expect(statusCode).to.equal(200)
    expect(body).to.equal(responseBody)
    scope.done()
  })

  // https://github.com/nock/nock/issues/1003
  it('correctly parse request without specified path', done => {
    const scope1 = nock('https://example.test').get('/').reply(200)

    https
      .request({ hostname: 'example.test' }, res => {
        expect(res.statusCode).to.equal(200)
        res.on('data', () => {})
        res.on('end', () => {
          scope1.done()
          done()
        })
      })
      .end()
  })

  it('data is sent with flushHeaders', done => {
    const scope1 = nock('https://example.test')
      .get('/')
      .reply(200, 'this is data')

    const onData = sinon.spy()
    https
      .request({ hostname: 'example.test' }, res => {
        expect(res.statusCode).to.equal(200)
        res.on('data', data => {
          onData()
          expect(data.toString()).to.equal('this is data')
        })
        res.on('end', () => {
          expect(onData).to.have.been.calledOnce()
          scope1.done()
          done()
        })
      })
      .flushHeaders()
  })

  it('wildcard param URL should not throw error', done => {
    expect(() => nock('http://example.test').get('*')).not.to.throw()
    done()
  })

  it('with filteringScope, URL path without leading slash does not throw error', done => {
    expect(() =>
      nock('http://example.test', { filteringScope: () => {} }).get('')
    ).not.to.throw()
    done()
  })

  it('no new keys were added to the global namespace', done => {
    const leaks = Object.keys(global).filter(
      key => !acceptableGlobalKeys.has(key)
    )
    expect(leaks).to.deep.equal([])
    done()
  })

  // These tests use `http` directly because `got` never calls `http` with the
  // three arg form.
  it('first arg as URL instance', done => {
    const scope = nock('http://example.test').get('/').reply()

    http.get(new url.URL('http://example.test'), () => {
      scope.done()
      done()
    })
  })

  it('three argument form of http.request: URL, options, and callback', done => {
    const responseText = 'this is data'
    const scope = nock('http://example.test')
      .get('/hello')
      .reply(201, responseText)

    http.get(new url.URL('http://example.test'), { path: '/hello' }, res => {
      expect(res.statusCode).to.equal(201)
      const onData = sinon.spy()
      res.on('data', chunk => {
        expect(chunk.toString()).to.equal(responseText)
        onData()
      })
      res.on('end', () => {
        // TODO Investigate why this doesn't work.
        // expect(onData).to.have.been.calledOnceWithExactly(responseText)
        expect(onData).to.have.been.calledOnce()
        scope.done()
        done()
      })
    })
  })

  /*
   * This test imitates a feature of node-http-proxy (https://github.com/nodejitsu/node-http-proxy) -
   * modifying headers for an in-flight request by modifying them.
   * https://github.com/nock/nock/pull/1484
   */
  it('works when headers are removed on the socket event', done => {
    // Set up a nock that will fail if it gets an "authorization" header.
    const scope = nock('http://example.test', { badheaders: ['authorization'] })
      .get('/endpoint')
      .reply()

    // Create a server to act as our reverse proxy.
    const server = http.createServer((request, response) => {
      // Make a request to the nock instance with the same request that came in.
      const proxyReq = http.request({
        host: 'example.test',
        // Get the path from the incoming request and pass it through.
        path: `/${request.url.split('/').slice(1).join('/')}`,
        headers: request.headers,
      })

      // When we connect, remove the authorization header (node-http-proxy uses
      // this event to do it).
      proxyReq.on('socket', () => {
        proxyReq.removeHeader('authorization')

        // End the request here, otherwise it ends up matching the request before
        // socket gets called because socket runs on `process.nextTick()`.
        proxyReq.end()
      })

      proxyReq.on('response', proxyRes => {
        proxyRes.pipe(response)
      })

      proxyReq.on('error', error => {
        expect.fail(error)
        done()
      })
    })

    server
      .listen(() => {
        // Now that the server's started up, make a request to it with an authorization header.
        const req = http.request(
          {
            hostname: 'localhost',
            path: '/endpoint',
            port: server.address().port,
            method: 'GET',
            headers: { authorization: 'blah' },
          },
          res => {
            // If we get a request, all good :)
            expect(res.statusCode).to.equal(200)
            scope.done()
            server.close(done)
          }
        )

        req.on('error', error => {
          expect.fail(error)
          done()
        })

        req.end()
      })
      .on('error', error => {
        expect.fail(error)
        done()
      })
  })
})
