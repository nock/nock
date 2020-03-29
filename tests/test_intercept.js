'use strict'

const http = require('http')
const https = require('https')
const { test } = require('tap')
const { expect } = require('chai')
const mikealRequest = require('request')
const sinon = require('sinon')
const superagent = require('superagent')
const assertRejects = require('assert-rejects')
const url = require('url')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

const acceptableGlobalKeys = new Set([
  ...Object.keys(global),
  '_key',
  '__core-js_shared__',
  'fetch',
  'Response',
  'Headers',
  'Request',
])

test('invalid or missing method parameter throws an exception', t => {
  expect(() => nock('https://example.test').intercept('/somepath')).to.throw(
    'The "method" parameter is required for an intercept call.'
  )
  t.end()
})

test("when the path doesn't include a leading slash it raises an error", t => {
  expect(() => nock('http://example.test').get('no-leading-slash')).to.throw(
    "Non-wildcard URL path strings must begin with a slash (otherwise they won't match anything)"
  )
  t.end()
})

test('get gets mocked', async t => {
  const scope = nock('http://example.test').get('/').reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    responseType: 'buffer',
  })

  expect(statusCode).to.equal(200)
  expect(body).to.be.an.instanceOf(Buffer)
  expect(body.toString('utf8')).to.equal('Hello World!')
  scope.done()
})

test('get gets mocked with relative base path', async t => {
  const scope = nock('http://example.test/abc')
    .get('/def')
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/abc/def', {
    responseType: 'buffer',
  })

  expect(statusCode).to.equal(200)
  expect(body).to.be.an.instanceOf(Buffer)
  expect(body.toString('utf8')).to.equal('Hello World!')
  scope.done()
})

test('post', async t => {
  const scope = nock('http://example.test').post('/form').reply(201, 'OK!')

  const { statusCode, body } = await got.post('http://example.test/form', {
    responseType: 'buffer',
  })

  expect(statusCode).to.equal(201)
  expect(body).to.be.an.instanceOf(Buffer)
  expect(body.toString('utf8')).to.equal('OK!')
  scope.done()
})

test('post with empty response body', async t => {
  const scope = nock('http://example.test').post('/form').reply()

  const { statusCode, body } = await got.post('http://example.test/form', {
    responseType: 'buffer',
  })

  expect(statusCode).to.equal(200)
  expect(body).to.be.an.instanceOf(Buffer)
  expect(body).to.have.lengthOf(0)
  scope.done()
})

test('post, lowercase', t => {
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
        t.end()
      })
    }
  )

  req.end()
})

test('post with regexp as spec', async t => {
  const input = 'key=val'

  const scope = nock('http://example.test')
    .post('/echo', /key=v.?l/g)
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got.post('http://example.test/echo', { body: input })

  expect(body).to.equal('OK /echo key=val')
  scope.done()
})

test('post with function as spec', async t => {
  const scope = nock('http://example.test')
    .post('/echo', body => body === 'key=val')
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got.post('http://example.test/echo', {
    body: 'key=val',
  })

  expect(body).to.equal('OK /echo key=val')
  scope.done()
})

test('post with chaining on call', async t => {
  const input = 'key=val'

  const scope = nock('http://example.test')
    .post('/echo', input)
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got.post('http://example.test/echo', { body: input })

  expect(body).to.equal('OK /echo key=val')
  scope.done()
})

test('delete request', async t => {
  const scope = nock('https://example.test').delete('/').reply(204)

  const { statusCode } = await got.delete('https://example.test')

  expect(statusCode).to.equal(204)
  scope.done()
})

// Not sure what is the intent of this test.
test('reply with callback and filtered path and body', async t => {
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

test('head', async t => {
  const scope = nock('http://example.test').head('/').reply(201, 'OK!')

  const { statusCode } = await got.head('http://example.test/')

  expect(statusCode).to.equal(201)
  scope.done()
})

test('body data is differentiating', async t => {
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

test('chaining', async t => {
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

test('encoding', async t => {
  const scope = nock('http://example.test').get('/').reply(200, 'Hello World!')

  const { body } = await got('http://example.test/', { encoding: 'base64' })

  expect(body).to.be.a('string').and.equal('SGVsbG8gV29ybGQh')

  scope.done()
})

test('on interceptor, filter path with function', async t => {
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

// TODO: Move to test_request_overrider.
test('abort request', t => {
  const scope = nock('http://example.test').get('/hey').reply(200, 'nobody')

  const req = http.request({
    host: 'example.test',
    path: '/hey',
  })

  req.on('response', res => {
    res.on('close', err => {
      expect(err.code).to.equal('aborted')
      scope.done()
    })

    res.on('end', () => expect.fail())

    req.once('error', err => {
      expect(err.code).to.equal('ECONNRESET')
      t.end()
    })

    req.abort()
  })

  req.end()
})

test('chaining API', async t => {
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

test('same URI', async t => {
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
test('can use hostname instead of host', t => {
  const scope = nock('http://example.test').get('/').reply(200, 'Hello World!')

  const req = http.request(
    {
      hostname: 'example.test',
      path: '/',
    },
    res => {
      expect(res.statusCode).to.equal(200)
      res.on('end', () => {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.end()
})

test('hostname is case insensitive', t => {
  const scope = nock('http://example.test').get('/path').reply()

  const req = http.request(
    {
      hostname: 'EXAMPLE.test',
      path: '/path',
      method: 'GET',
    },
    res => {
      scope.done()
      t.end()
    }
  )
  req.end()
})

test('can take a port', async t => {
  const scope = nock('http://example.test:3333').get('/').reply()

  const { statusCode } = await got('http://example.test:3333/')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('can use https', async t => {
  const scope = nock('https://example.test').get('/').reply()

  const { statusCode } = await got('https://example.test/', {
    responseType: 'buffer',
  })

  expect(statusCode).to.equal(200)
  scope.done()
})

test('emits error when listeners are added after `req.end()` call', t => {
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
    t.end()
  })
})

test('emits error if https route is missing', t => {
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
    t.end()
  })
  req.end()
})

test('emits error if https route is missing', t => {
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
    t.end()
  })
  req.end()
})

test('scopes are independent', async t => {
  const scope1 = nock('http://example.test').get('/').reply(200, 'Hello World!')
  const scope2 = nock('http://example.test').get('/').reply(200, 'Hello World!')

  await got('http://example.test/')

  expect(scope1.isDone()).to.be.true()
  expect(scope2.isDone()).to.be.false()
})

test('two scopes with the same request are consumed', async t => {
  const scope1 = nock('http://example.test').get('/').reply(200, 'Hello World!')

  const scope2 = nock('http://example.test').get('/').reply(200, 'Hello World!')

  await got('http://example.test/')
  await got('http://example.test/')

  scope1.done()
  scope2.done()
})

// TODO: Move this test to test_header_matching.
test('username and password works', t => {
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
        t.end()
      }
    )
    .end()
})

test('Matches with a username and password in the URL', async t => {
  const scope = nock('http://example.test')
    .get('/abc')
    .reply(function () {
      // TODO Investigate why we don't get an authorization header.
      // expect(this.req.headers).to.include({ Authorization: 'foobar' })
      return [200]
    })

  const { statusCode } = await got('http://username:password@example.test/abc')
  expect(statusCode).to.equal(200)

  scope.done()
})

test('different port works', t => {
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
        t.end()
      }
    )
    .end()
})

test('explicitly specifiying port 80 works', t => {
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
        t.end()
      }
    )
    .end()
})

test('post with object', t => {
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
        t.end()
      }
    )
    .end('{"some_data":"something"}')
})

test('accept string as request target', t => {
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
      t.end()
    })
  })
})

test('superagent works', t => {
  const responseText = 'Yay superagent!'
  const headers = { 'Content-Type': 'text/plain' }
  nock('http://example.test').get('/somepath').reply(200, responseText, headers)

  superagent.get('http://example.test/somepath').end(function (err, res) {
    t.error(err)
    t.equal(res.text, responseText)
    t.end()
  })
})

test('superagent works with query string', t => {
  const responseText = 'Yay superagentzzz'
  const headers = { 'Content-Type': 'text/plain' }
  nock('http://example.test')
    .get('/somepath?a=b')
    .reply(200, responseText, headers)

  superagent.get('http://example.test/somepath?a=b').end(function (err, res) {
    t.error(err)
    t.equal(res.text, responseText)
    t.end()
  })
})

test('superagent posts', t => {
  nock('http://example.test').post('/somepath?b=c').reply(204)

  superagent
    .post('http://example.test/somepath?b=c')
    .send('some data')
    .end(function (err, res) {
      t.error(err)
      t.equal(res.status, 204)
      t.end()
    })
})

test('sending binary and receiving JSON should work', async t => {
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

// TODO: What is the intention of this test? Should it be kept?
test('test request timeout option', t => {
  nock('http://example.test')
    .get('/path')
    .reply(200, JSON.stringify({ foo: 'bar' }))

  const options = {
    url: 'http://example.test/path',
    method: 'GET',
    timeout: 2000,
  }

  mikealRequest(options, function (err, res, body) {
    t.strictEqual(err, null)
    t.equal(body, '{"foo":"bar"}')
    t.end()
  })
})

test('do not match when conditionally = false but should match after trying again when = true', async t => {
  let enabled = false

  const scope = nock('http://example.test', { conditionally: () => enabled })
    .get('/')
    .reply(200)

  await assertRejects(got('http://example.test/'), /Nock: No match for request/)
  expect(scope.isDone()).to.be.false()

  enabled = true

  const { statusCode } = await got('http://example.test/')

  expect(statusCode).to.equal(200)
  scope.done()
})

// TODO: Try to convert to async/got.
test('get correct filtering with scope and request headers filtering', t => {
  const responseText = 'OK!'
  const requestHeaders = { host: 'foo.example.test' }

  const scope = nock('http://foo.example.test', {
    filteringScope: scope => /^http:\/\/.*\.example\.test/.test(scope),
  })
    .get('/path')
    .reply(200, responseText, { 'Content-Type': 'text/plain' })

  const onData = sinon.spy()
  const req = http.get(
    {
      host: 'bar.example.test',
      method: 'GET',
      path: '/path',
      port: 80,
    },
    res => {
      res.on('data', data => {
        onData()
        expect(data.toString()).to.equal(responseText)
      })
      res.on('end', () => {
        expect(onData).to.have.been.calledOnce()
        scope.done()
        t.end()
      })
    }
  )

  expect(req.getHeaders()).to.deep.equal({ host: requestHeaders.host })
})

test('different subdomain with reply callback and filtering scope', async t => {
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

// TODO: Rewrite using got or http.
test('mocking succeeds even when host request header is not specified', t => {
  nock('http://example.test').post('/resource').reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.test/resource',
      headers: {
        'X-App-TOKEN': 'apptoken',
        'X-Auth-TOKEN': 'apptoken',
      },
    },
    function (err, res, body) {
      t.type(err, 'null')
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

// TODO: Investigate the underlying issue.
// https://github.com/nock/nock/issues/158
test('mikeal/request with strictSSL: true', t => {
  nock('https://example.test').post('/what').reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'https://example.test/what',
      strictSSL: true,
    },
    function (err, res) {
      expect(err).to.be.null()
      expect(res.statusCode).to.deep.equal(200)
      t.end()
    }
  )
})

test('match domain using regexp', async t => {
  const scope = nock(/regexexample\.test/)
    .get('/resources')
    .reply()

  const { statusCode } = await got('http://regexexample.test/resources')
  expect(statusCode).to.equal(200)
  scope.done()
})

// https://github.com/nock/nock/issues/1137
test('match domain using regexp with path as callback', async t => {
  const scope = nock(/.*/)
    .get(() => true)
    .reply(200, 'Match regex')

  const { statusCode } = await got('http://example.test/resources')
  expect(statusCode).to.equal(200)
  scope.done()
})

// https://github.com/nock/nock/issues/508
test('match multiple interceptors with regexp domain', async t => {
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

test('interceptors should work in any order', async t => {
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

test('interceptors should work in any order with filteringScope', async t => {
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

// FIXME: This marked as { todo: true } because it is an existing bug.
// https://github.com/nock/nock/issues/1108
test(
  'match hostname as regex and string in tandem',
  { todo: true },
  async t => {
    const scope1 = nock(/.*/).get('/hello/world').reply()
    const scope2 = nock('http://example.test').get('/hello/planet').reply()

    const response1 = await got('http://example.test/hello/world')
    expect(response1.statusCode).to.equal(200)
    scope1.done()

    const response2 = await got('http://example.test/hello/planet')
    expect(response2.statusCode).to.equal(200)
    scope2.done()
  }
)

test('match domain using intercept callback', async t => {
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

test('match path using regexp', async t => {
  nock('http://example.test')
    .get(/regex$/)
    .reply(200, 'Match regex')

  const { statusCode, body } = await got('http://example.test/resources/regex')
  expect(statusCode).to.equal(200)
  expect(body).to.equal('Match regex')
})

test('match path using function', async t => {
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

  const postResponse = await got.post('http://example.test/match/uri/function')
  expect(postResponse).to.include({ statusCode: 200, body: `Match POST` })

  const getResponse = await got('http://example.test/match/uri/function')
  expect(getResponse).to.include({ statusCode: 200, body: `Match GET` })

  await assertRejects(
    got.head('http://example.test/do/not/match'),
    /Nock: No match for request/
  )
})

test('you must setup an interceptor for each request', async t => {
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
test('no content type provided', t => {
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
          t.end()
        })
      }
    )
    .end('WHAA')
})

// https://github.com/nock/nock/issues/835
test('match domain and path using regexp', async t => {
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
test('correctly parse request without specified path', t => {
  const scope1 = nock('https://example.test').get('/').reply(200)

  https
    .request({ hostname: 'example.test' }, res => {
      expect(res.statusCode).to.equal(200)
      res.on('data', () => {})
      res.on('end', () => {
        scope1.done()
        t.end()
      })
    })
    .end()
})

test('data is sent with flushHeaders', t => {
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
        t.end()
      })
    })
    .flushHeaders()
})

// https://github.com/nock/nock/issues/1730
test('URL path without leading slash throws expected error', t => {
  expect(() => nock('http://example.test').get('')).to.throw(
    "Non-wildcard URL path strings must begin with a slash (otherwise they won't match anything) (got: )"
  )
  t.end()
})

test('wildcard param URL should not throw error', t => {
  expect(() => nock('http://example.test').get('*')).not.to.throw()
  t.end()
})

test('with filteringScope, URL path without leading slash does not throw error', t => {
  expect(() =>
    nock('http://example.test', { filteringScope: () => {} }).get('')
  ).not.to.throw()
  t.end()
})

test('no new keys were added to the global namespace', t => {
  const leaks = Object.keys(global).filter(
    key => !acceptableGlobalKeys.has(key)
  )
  expect(leaks).to.deep.equal([])
  t.end()
})

// These tests use `http` directly because `got` never calls `http` with the
// three arg form.
test('first arg as URL instance', t => {
  const scope = nock('http://example.test').get('/').reply()

  http.get(new url.URL('http://example.test'), () => {
    scope.done()
    t.end()
  })
})

test('three argument form of http.request: URL, options, and callback', t => {
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
      t.done()
    })
  })
})

/*
 * This test imitates a feature of node-http-proxy (https://github.com/nodejitsu/node-http-proxy) -
 * modifying headers for an in-flight request by modifying them.
 * https://github.com/nock/nock/pull/1484
 */
test('works when headers are removed on the socket event', t => {
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
      t.error(error)
      t.end()
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
          server.close(t.end)
        }
      )

      req.on('error', error => {
        expect.fail(error)
        t.end()
      })

      req.end()
    })
    .on('error', error => {
      expect.fail(error)
      t.end()
    })
})
