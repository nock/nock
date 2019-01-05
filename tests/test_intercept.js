'use strict'

const fs = require('fs')
const path = require('path')
const nock = require('../.')
const url = require('url')
const http = require('http')
const https = require('https')
const util = require('util')
const events = require('events')
const stream = require('stream')
const { test } = require('tap')
const mikealRequest = require('request')
const superagent = require('superagent')
const needle = require('needle')
const restify = require('restify-clients')
const domain = require('domain')
const hyperquest = require('hyperquest')
const async = require('async')
const got = require('got')

const ssl = require('./ssl')

nock.enableNetConnect()

const globalCount = Object.keys(global).length
const acceptableLeaks = [
  '_key',
  '__core-js_shared__',
  'fetch',
  'Response',
  'Headers',
  'Request',
]

test('invalid or missing method parameter throws an exception', t => {
  t.throws(() => nock('https://example.com').intercept('/somepath'), {
    message: 'The "method" parameter is required for an intercept call.',
  })
  t.end()
})

test('double activation throws exception', t => {
  nock.restore()
  t.false(nock.isActive())

  nock.activate()
  t.true(nock.isActive())

  t.throws(() => nock.activate(), { message: 'Nock already active' })

  t.true(nock.isActive())

  t.end()
})

test('allow unmocked works (2)', async t => {
  const scope = nock('http://example.com', { allowUnmocked: true })
    .post('/post')
    .reply(200, '99problems')

  await got.post('http://example.com/post')

  scope.done()
})

test('allow unmocked works after one interceptor is removed', async t => {
  const server = http.createServer((request, response) => {
    response.write('live')
    response.end()
  })
  t.once('end', () => server.close())

  await new Promise(resolve => server.listen(resolve))

  const url = `http://localhost:${server.address().port}`

  nock(url, { allowUnmocked: true })
    .get('/')
    .reply(200, 'Mocked')

  t.equal((await got(url)).body, 'Mocked')
  t.equal((await got(url)).body, 'live')
})

test("when request's content-type is json: reply callback's requestBody should automatically parse to JSON", async t => {
  const requestBodyFixture = {
    id: 1,
    name: 'bob',
  }

  const scope = nock('http://service')
    .post('/endpoint')
    .reply(200, (uri, requestBody) => {
      t.deepEqual(requestBody, requestBodyFixture)
      return 'overwrite'
    })

  const { body } = await got.post('http://service/endpoint', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBodyFixture),
  })

  t.equal(body, 'overwrite')
  scope.done()
})

test("when request has no content-type header: reply callback's requestBody should not automatically parse to JSON", async t => {
  const requestBodyFixture = {
    id: 1,
    name: 'bob',
  }

  const scope = nock('http://service')
    .post('/endpoint')
    .reply(200, (uri, requestBody) => {
      t.deepEqual(requestBody, JSON.stringify(requestBodyFixture))
      return 'overwrite'
    })

  const { body } = await got.post('http://service/endpoint', {
    body: JSON.stringify(requestBodyFixture),
  })

  t.equal(body, 'overwrite')
  scope.done()
})

test('reply can take a callback', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, (path, requestBody, callback) => callback(null, 'Hello World!'))

  const response = await got('http://example.com/', {
    encoding: null,
  })

  scope.done()
  t.type(response.body, Buffer)
  t.equal(response.body.toString('utf8'), 'Hello World!')
})

test('reply should send correct statusCode with array-notation and without body', async t => {
  t.plan(1)

  const expectedStatusCode = 202

  const scope = nock('http://example.com')
    .get('/')
    .reply((path, requestBody) => [expectedStatusCode])

  const { statusCode } = await got('http://example.com/')

  t.equal(statusCode, expectedStatusCode)
  scope.done()
})

test('reply takes a callback for status code', async t => {
  const expectedStatusCode = 202
  const responseBody = 'Hello, world!'
  const headers = {
    'X-Custom-Header': 'abcdef',
  }

  const scope = nock('http://example.com')
    .get('/')
    .reply((path, requestBody, cb) => {
      setTimeout(() => cb(null, [expectedStatusCode, responseBody, headers]), 1)
    })

  const response = await got('http://example.com/')

  t.equal(response.statusCode, expectedStatusCode, 'sends status code')
  t.deepEqual(response.headers, headers, 'sends headers')
  t.equal(response.body, responseBody, 'sends request body')
  scope.done()
})

test('reply should throw on error on the callback', t => {
  let dataCalled = false

  const scope = nock('http://example.com')
    .get('/')
    .reply(500, (path, requestBody, callback) =>
      callback(new Error('Database failed'))
    )

  // TODO When this request is converted to `got`, it causes the request not
  // to match.
  const req = http.request(
    {
      host: 'example.com',
      path: '/',
      port: 80,
    },
    res => {
      t.equal(res.statusCode, 500, 'Status code is 500')

      res.on('data', data => {
        dataCalled = true
        t.ok(data instanceof Buffer, 'data should be buffer')
        t.ok(
          data.toString().indexOf('Error: Database failed') === 0,
          'response should match'
        )
      })

      res.on('end', () => {
        t.ok(dataCalled, 'data handler was called')
        scope.done()
        t.end()
      })
    }
  )

  req.end()
})

test('reply should not cause an error on header conflict', async t => {
  const scope = nock('http://example.com').defaultReplyHeaders({
    'content-type': 'application/json',
  })

  scope.get('/').reply(200, '<html></html>', {
    'Content-Type': 'application/xml',
  })

  const { statusCode, headers, body } = await got('http://example.com/')

  t.equal(statusCode, 200)
  t.equal(headers['content-type'], 'application/xml')
  t.equal(body, '<html></html>')
  scope.done()
})

test('get gets mocked', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.com/', {
    encoding: null,
  })

  t.equal(statusCode, 200)
  t.type(body, Buffer)
  t.equal(body.toString('utf8'), 'Hello World!')
  scope.done()
})

test('get gets mocked with relative base path', async t => {
  const scope = nock('http://example.com/abc')
    .get('/def')
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.com/abc/def', {
    encoding: null,
  })

  t.equal(statusCode, 200)
  t.type(body, Buffer)
  t.equal(body.toString('utf8'), 'Hello World!')
  scope.done()
})

test('post', async t => {
  const scope = nock('http://example.com')
    .post('/form')
    .reply(201, 'OK!')

  const { statusCode, body } = await got.post('http://example.com/form', {
    encoding: null,
  })

  t.equal(statusCode, 201)
  t.type(body, Buffer)
  t.equal(body.toString('utf8'), 'OK!')
  scope.done()
})

test('post with empty response body', async t => {
  const scope = nock('http://example.com')
    .post('/form')
    .reply(200)

  const { statusCode, body } = await got.post('http://example.com/form', {
    encoding: null,
  })

  t.equal(statusCode, 200)
  t.type(body, Buffer)
  t.equal(body.length, 0)
  scope.done()
})

test('post, lowercase', t => {
  let dataCalled = false

  const scope = nock('http://example.com')
    .post('/form')
    .reply(200, 'OK!')

  // Since this is testing a lowercase `method`, it's using the `http` module.
  const req = http.request(
    {
      host: 'example.com',
      method: 'post',
      path: '/form',
      port: 80,
    },
    res => {
      t.equal(res.statusCode, 200)
      res.on('end', () => {
        t.ok(dataCalled)
        scope.done()
        t.end()
      })
      res.on('data', data => {
        dataCalled = true
        t.ok(data instanceof Buffer, 'data should be buffer')
        t.equal(data.toString(), 'OK!', 'response should match')
      })
    }
  )

  req.end()
})

test('get with reply callback', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, () => 'OK!')

  const { body } = await got('http://example.com')
  t.equal(body, 'OK!')
  scope.done()
})

test('get to different subdomain with reply callback and filtering scope', async t => {
  // We scope for www.example.com but through scope filtering we will accept
  // any <subdomain>.example.com.
  const scope = nock('http://www.example.com', {
    filteringScope: scope => /^http:\/\/.*\.example\.com/.test(scope),
  })
    .get('/')
    .reply(200, () => 'OK!')

  const { body } = await got('http://any-subdomain-will-do.example.com')
  t.equal(body, 'OK!')
  scope.done()
})

test('get with reply callback returning object', async t => {
  const exampleResponse = { message: 'OK!' }

  const scope = nock('http://example.com')
    .get('/')
    .reply(200, () => exampleResponse)

  const { body } = await got('http://example.com')
  t.equal(body, JSON.stringify(exampleResponse))
  scope.done()
})

test('get with reply callback returning array with headers', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(() => [202, 'body', { 'x-key': 'value', 'x-key-2': 'value 2' }])

  const { headers, rawHeaders } = await got('http://example.test/')

  t.deepEqual(headers, {
    'x-key': 'value',
    'x-key-2': 'value 2',
  })
  t.deepEqual(rawHeaders, ['x-key', 'value', 'x-key-2', 'value 2'])
  scope.done()
})

// Skipped because https://github.com/nock/nock/issues/1222
test(
  'get with reply callback returning default statusCode without body',
  { skip: true },
  t => {
    nock('http://replyheaderland')
      .get('/')
      .reply((uri, requestBody) => [401])

    http.get(
      {
        host: 'replyheaderland',
        path: '/',
        port: 80,
      },
      res => {
        res.setEncoding('utf8')
        t.equal(res.statusCode, 200)
        res.on('data', data => {
          t.equal(data, '[401]')
          res.once('end', t.end.bind(t))
        })
      }
    )
  }
)

test('get with reply callback returning callback without headers', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(() => [401, 'This is a body'])

  await t.rejects(async () => got('http://example.com/'), {
    statusCode: 401,
    body: 'This is a body',
  })
  scope.done()
})

test('post with reply callback, uri, and request body', async t => {
  const input = 'key=val'

  const scope = nock('http://example.com')
    .post('/echo', input)
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got('http://example.com/echo', { body: input })
  t.equal(body, 'OK /echo key=val')
  scope.done()
})

test('post with regexp as spec', async t => {
  const input = 'key=val'

  const scope = nock('http://example.com')
    .post('/echo', /key=v.?l/g)
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got('http://example.com/echo', { body: input })

  t.equal(body, 'OK /echo key=val')
  scope.done()
})

test('post with function as spec', async t => {
  const scope = nock('http://example.com')
    .post('/echo', body => body === 'key=val')
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got('http://example.com/echo', { body: 'key=val' })

  t.equal(body, 'OK /echo key=val')
  scope.done()
})

test('post with chaining on call', async t => {
  const input = 'key=val'

  const scope = nock('http://example.com')
    .post('/echo', input)
    .reply(200, (uri, body) => ['OK', uri, body].join(' '))

  const { body } = await got('http://example.com/echo', { body: input })

  t.equal(body, 'OK /echo key=val')
  scope.done()
})

test('reply with callback and filtered path and body', async t => {
  let noPrematureExecution = false

  const scope = nock('http://example.com')
    .filteringPath(/.*/, '*')
    .filteringRequestBody(/.*/, '*')
    .post('*', '*')
    .reply(200, (uri, body) => {
      t.assert(noPrematureExecution)
      return ['OK', uri, body].join(' ')
    })

  noPrematureExecution = true
  const { body } = await got.post('http://example.com/original/path', {
    body: 'original=body',
  })

  t.equal(body, 'OK /original/path original=body')
  scope.done()
})

test('isDone', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'Hello World!')

  t.notOk(scope.isDone(), 'not done when a request is outstanding')

  await got('http://example.com/')

  t.true(scope.isDone(), 'done after request is made')
  scope.done()
})

test('request headers exposed', t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'Hello World!', { 'X-My-Headers': 'My Header value' })

  // Testing that the req is augmented, so using `http`.
  const req = http.get(
    {
      host: 'example.com',
      method: 'GET',
      path: '/',
      port: 80,
      headers: { 'X-My-Headers': 'My custom Header value' },
    },
    res => {
      res.on('end', () => {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  t.equivalent(req._headers, {
    'x-my-headers': 'My custom Header value',
    host: 'example.com',
  })
})

test('headers work', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'Hello World!', { 'X-My-Headers': 'My Header value' })

  const { headers } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'My Header value' })
  scope.done()
})

test('reply headers work with function', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, () => 'ABC', { 'X-My-Headers': 'My custom header value' })

  const { headers } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'My custom header value' })
  scope.done()
})

test('reply headers as function work', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => body.toString(),
    })

  const { headers, rawHeaders } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'boo!' })
  t.equivalent(rawHeaders, ['X-My-Headers', 'boo!'])
  scope.done()
})

test('reply headers as function are evaluated only once per request', async t => {
  let counter = 0
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => {
        ++counter
        return body.toString()
      },
    })

  const { headers, rawHeaders } = await got('http://example.com/')

  t.equivalent(headers, { 'x-my-headers': 'boo!' })
  t.equivalent(rawHeaders, ['X-My-Headers', 'boo!'])
  scope.done()

  t.equal(counter, 1)
})

test('reply headers as function are evaluated on each request', async t => {
  let counter = 0
  const scope = nock('http://example.com')
    .get('/')
    .times(2)
    .reply(200, 'boo!', {
      'X-My-Headers': (req, res, body) => `${++counter}`,
    })

  const { headers, rawHeaders } = await got('http://example.com/')
  t.equivalent(headers, { 'x-my-headers': '1' })
  t.equivalent(rawHeaders, ['X-My-Headers', '1'])

  t.equal(counter, 1)

  const { headers: headers2, rawHeaders: rawHeaders2 } = await got(
    'http://example.com/'
  )
  t.equivalent(headers2, { 'x-my-headers': '2' })
  t.equivalent(rawHeaders2, ['X-My-Headers', '2'])

  t.equal(counter, 2)

  scope.done()
})

test('match headers', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', 'My custom Header value')
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 'My custom Header value' },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('multiple match headers', async t => {
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

  t.equal(response1.statusCode, 200)
  t.equal(response1.body, 'Hello World other value!')

  const response2 = await got('http://example.test/', {
    headers: { 'X-My-Headers': 'My custom Header value' },
  })

  t.equal(response2.statusCode, 200)
  t.equal(response2.body, 'Hello World!')
})

test('match headers with regexp', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', /My He.d.r [0-9.]+/)
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 'My Header 1.0' },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('match headers on number with regexp', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', /\d+/)
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 123 },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('match headers with function', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', val => val > 123)
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 456 },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('match all headers', async t => {
  const scope = nock('http://example.test')
    .matchHeader('accept', 'application/json')
    .get('/one')
    .reply(200, { hello: 'world' })
    .get('/two')
    .reply(200, { a: 1, b: 2, c: 3 })

  const response1 = await got('http://example.test/one', {
    headers: { Accept: 'application/json' },
  })
  t.equal(response1.statusCode, 200)
  t.equal(response1.body, '{"hello":"world"}')

  const response2 = await got('http://example.test/two', {
    headers: { Accept: 'application/json' },
  })
  t.equal(response2.statusCode, 200)
  t.equal(response2.body, '{"a":1,"b":2,"c":3}')

  scope.done()
})

test('header manipulation', t => {
  // This test seems to depend on behavior of the `http` module.
  const scope = nock('http://example.com')
    .get('/accounts')
    .reply(200, { accounts: [{ id: 1, name: 'Joe Blow' }] })

  const req = http.get({ host: 'example.com', path: '/accounts' }, res => {
    res.on('end', () => {
      scope.done()
      t.end()
    })
    // Streams start in 'paused' mode and must be started.
    // See https://nodejs.org/api/stream.html#stream_class_stream_readable
    res.resume()
  })

  req.setHeader('X-Custom-Header', 'My Value')
  t.equal(
    req.getHeader('X-Custom-Header'),
    'My Value',
    'Custom header was not set'
  )

  req.removeHeader('X-Custom-Header')
  t.notOk(req.getHeader('X-Custom-Header'), 'Custom header was not removed')

  req.end()
})

test('head', async t => {
  const scope = nock('http://example.test')
    .head('/')
    .reply(201, 'OK!')

  const { statusCode } = await got.head('http://example.test/')

  t.equal(statusCode, 201)
  scope.done()
})

test('body data is differentiating', async t => {
  const scope = nock('http://example.test')
    .post('/', 'abc')
    .reply(200, 'Hey 1')
    .post('/', 'def')
    .reply(200, 'Hey 2')

  const response1 = await got('http://example.test/', { body: 'abc' })
  t.equal(response1.statusCode, 200)
  t.equal(response1.body, 'Hey 1')

  const response2 = await got('http://example.test/', { body: 'def' })
  t.equal(response2.statusCode, 200)
  t.equal(response2.body, 'Hey 2')

  scope.done()
})

test('chaining', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')
    .post('/form')
    .reply(201, 'OK!')

  const response1 = await got.post('http://example.test/form')
  t.equal(response1.statusCode, 201)
  t.equal(response1.body, 'OK!')

  const response2 = await got('http://example.test/')
  t.equal(response2.statusCode, 200)
  t.equal(response2.body, 'Hello World!')

  scope.done()
})

test('encoding', async t => {
  let dataCalled = false

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  const { body } = await got('http://example.test/', { encoding: 'base64' })

  t.type(body, 'string')
  t.equal(body, 'SGVsbG8gV29ybGQh', 'response should match base64 encoding')
})

test('reply with file', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(
      200,
      path.join(__dirname, '..', 'assets', 'reply_file_1.txt')
    )
    .get('/test')
    .reply(200, 'Yay!')

  const { statusCode, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.equal(body, 'Hello from the file!')

  // We leave one request unmade.
  nock.cleanAll()
})

// TODO convert to async / got.
test('reply with file and pipe response', t => {
  nock('http://www.files.com')
    .get('/')
    .replyWithFile(
      200,
      path.join(__dirname, '..', 'assets', 'reply_file_1.txt')
    )

  http.get(
    {
      host: 'www.files.com',
      path: '/',
      port: 80,
    },
    res => {
      let str = ''
      const fakeStream = new (require('stream')).Stream()
      fakeStream.writable = true

      fakeStream.write = d => {
        str += d
      }

      fakeStream.end = () => {
        t.equal(str, 'Hello from the file!', 'response should match')
        t.end()
      }

      res.pipe(fakeStream)
      res.setEncoding('utf8')
      t.equal(res.statusCode, 200)
    }
  )
})

test('reply with file with headers', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(
      200,
      path.join(__dirname, '..', 'assets', 'reply_file_2.txt.gz'),
      {
        'content-encoding': 'gzip',
      }
    )

  const { statusCode, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.equal(body.length, 20)
  scope.done()
})

test('reply with JSON', t => {
  let dataCalled = false

  const scope = nock('http://www.jsonreplier.com')
    .get('/')
    .reply(200, { hello: 'world' })

  const req = http.request(
    {
      host: 'www.jsonreplier.com',
      path: '/',
      port: 80,
    },
    res => {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 200)
      t.notOk(res.headers['date'])
      t.notOk(res.headers['content-length'])
      t.equal(res.headers['content-type'], 'application/json')
      res.on('end', () => {
        t.ok(dataCalled)
        scope.done()
        t.end()
      })
      res.on('data', data => {
        dataCalled = true
        t.equal(data.toString(), '{"hello":"world"}', 'response should match')
      })
    }
  )

  req.end()
})

test('reply with content-length header', t => {
  const scope = nock('http://www.jsonreplier.com')
    .replyContentLength()
    .get('/')
    .reply(200, { hello: 'world' })

  http.get(
    {
      host: 'www.jsonreplier.com',
      path: '/',
      port: 80,
    },
    res => {
      t.equal(res.headers['content-length'], 17)
      res.on('end', () => {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )
})

test('reply with date header', t => {
  const date = new Date()

  const scope = nock('http://www.jsonreplier.com')
    .replyDate(date)
    .get('/')
    .reply(200, { hello: 'world' })

  http.get(
    {
      host: 'www.jsonreplier.com',
      path: '/',
      port: 80,
    },
    res => {
      t.equal(res.headers['date'], date.toUTCString())
      res.on('end', () => {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )
})

test('filter path with function', t => {
  const scope = nock('http://www.filterurls.com')
    .filteringPath(path => '/?a=2&b=1')
    .get('/?a=2&b=1')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      host: 'www.filterurls.com',
      method: 'GET',
      path: '/?a=1&b=2',
      port: 80,
    },
    res => {
      t.equal(res.statusCode, 200)
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

test('filter path with regexp', t => {
  const scope = nock('http://www.filterurlswithregexp.com')
    .filteringPath(/\d/g, '3')
    .get('/?a=3&b=3')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      host: 'www.filterurlswithregexp.com',
      method: 'GET',
      path: '/?a=1&b=2',
      port: 80,
    },
    res => {
      t.equal(res.statusCode, 200)
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

test('filter body with function', t => {
  let filteringRequestBodyCounter = 0

  const scope = nock('http://www.filterboddiez.com')
    .filteringRequestBody(body => {
      ++filteringRequestBodyCounter
      t.equal(body, 'mamma mia')
      return 'mamma tua'
    })
    .post('/', 'mamma tua')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      host: 'www.filterboddiez.com',
      method: 'POST',
      path: '/',
      port: 80,
    },
    res => {
      t.equal(res.statusCode, 200)
      res.on('end', () => {
        scope.done()
        t.equal(filteringRequestBodyCounter, 1)
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.end('mamma mia')
})

test('filter body with regexp', t => {
  const scope = nock('http://www.filterboddiezregexp.com')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      host: 'www.filterboddiezregexp.com',
      method: 'POST',
      path: '/',
      port: 80,
    },
    res => {
      t.equal(res.statusCode, 200)
      res.on('end', () => {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.end('mamma mia')
})

test('abort request', t => {
  const scope = nock('http://www.google.com')
    .get('/hey')
    .reply(200, 'nobody')

  const req = http.request({
    host: 'www.google.com',
    path: '/hey',
  })

  req.on('response', res => {
    res.on('close', err => {
      t.equal(err.code, 'aborted')
      scope.done()
    })

    res.on('end', () => t.fail('this should never execute'))

    req.once('error', err => {
      t.equal(err.code, 'ECONNRESET')
      t.end()
    })

    req.abort()
  })

  req.end()
})

test('pause response before data', t => {
  const scope = nock('http://www.mouse.com')
    .get('/pauser')
    .reply(200, 'nobody')

  const req = http.request({
    host: 'www.mouse.com',
    path: '/pauser',
  })

  req.on('response', res => {
    res.pause()

    let waited = false
    setTimeout(() => {
      waited = true
      res.resume()
    }, 500)

    res.on('data', data => t.true(waited))

    res.on('end', () => {
      scope.done()
      t.end()
    })
  })

  req.end()
})

test('pause response after data', t => {
  const response = new stream.PassThrough()
  const scope = nock('http://pauseme.com')
    .get('/')
    // Node does not pause the 'end' event so we need to use a stream to simulate
    // multiple 'data' events.
    .reply(200, response)

  http.get(
    {
      host: 'pauseme.com',
      path: '/',
    },
    res => {
      let waited = false
      setTimeout(() => {
        waited = true
        res.resume()
      }, 500)

      res.on('data', data => res.pause())

      res.on('end', () => {
        t.true(waited)
        scope.done()
        t.end()
      })
    }
  )

  // Manually simulate multiple 'data' events.
  response.emit('data', 'one')
  setTimeout(() => {
    response.emit('data', 'two')
    response.end()
  }, 0)
})

test('response pipe', t => {
  const dest = (() => {
    function Constructor() {
      events.EventEmitter.call(this)

      this.buffer = Buffer.alloc(0)
      this.writable = true
    }

    util.inherits(Constructor, events.EventEmitter)

    Constructor.prototype.end = function() {
      this.emit('end')
    }

    Constructor.prototype.write = function(chunk) {
      const buf = Buffer.alloc(this.buffer.length + chunk.length)

      this.buffer.copy(buf)
      chunk.copy(buf, this.buffer.length)

      this.buffer = buf

      return true
    }

    return new Constructor()
  })()

  const scope = nock('http://pauseme.com')
    .get('/')
    .reply(200, 'nobody')

  http.get(
    {
      host: 'pauseme.com',
      path: '/',
    },
    res => {
      dest.on('pipe', () => t.pass('should emit "pipe" event'))

      dest.on('end', () => {
        scope.done()
        t.equal(dest.buffer.toString(), 'nobody')
        t.end()
      })

      res.pipe(dest)
    }
  )
})

test('response pipe without implicit end', t => {
  const dest = (() => {
    function Constructor() {
      events.EventEmitter.call(this)

      this.buffer = Buffer.alloc(0)
      this.writable = true
    }

    util.inherits(Constructor, events.EventEmitter)

    Constructor.prototype.end = function() {
      this.emit('end')
    }

    Constructor.prototype.write = function(chunk) {
      const buf = Buffer.alloc(this.buffer.length + chunk.length)

      this.buffer.copy(buf)
      chunk.copy(buf, this.buffer.length)

      this.buffer = buf

      return true
    }

    return new Constructor()
  })()

  const scope = nock('http://pauseme.com')
    .get('/')
    .reply(200, 'nobody')

  http.get(
    {
      host: 'pauseme.com',
      path: '/',
    },
    res => {
      dest.on('end', () => t.fail('should not call end implicitly'))

      res.on('end', () => {
        scope.done()
        t.pass('should emit end event')
        t.end()
      })

      res.pipe(
        dest,
        { end: false }
      )
    }
  )
})

test('chaining API', t => {
  const scope = nock('http://chainchomp.com')
    .get('/one')
    .reply(200, 'first one')
    .get('/two')
    .reply(200, 'second one')

  http.get(
    {
      host: 'chainchomp.com',
      path: '/one',
    },
    res => {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 200, 'status should be ok')
      res.on('data', data =>
        t.equal(data, 'first one', 'should be equal to first reply')
      )

      res.on('end', () => {
        http.get(
          {
            host: 'chainchomp.com',
            path: '/two',
          },
          res => {
            res.setEncoding('utf8')
            t.equal(res.statusCode, 200, 'status should be ok')
            res.on('data', data =>
              t.equal(data, 'second one', 'should be qual to second reply')
            )

            res.on('end', () => {
              scope.done()
              t.end()
            })
          }
        )
      })
    }
  )
})

test('same URI', t => {
  const scope = nock('http://sameurii.com')
    .get('/abc')
    .reply(200, 'first one')
    .get('/abc')
    .reply(200, 'second one')

  http.get(
    {
      host: 'sameurii.com',
      path: '/abc',
    },
    function(res) {
      res.on('data', function(data) {
        res.setEncoding('utf8')
        t.equal(data.toString(), 'first one', 'should be qual to first reply')
        res.on('end', function() {
          http.get(
            {
              host: 'sameurii.com',
              path: '/abc',
            },
            function(res) {
              res.setEncoding('utf8')
              res.on('data', function(data) {
                t.equal(
                  data.toString(),
                  'second one',
                  'should be qual to second reply'
                )
                res.on('end', function() {
                  scope.done()
                  t.end()
                })
              })
            }
          )
        })
      })
    }
  )
})

test('can use hostname instead of host', t => {
  const scope = nock('http://www.google.com')
    .get('/')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      hostname: 'www.google.com',
      path: '/',
    },
    function(res) {
      t.equal(res.statusCode, 200)
      res.on('end', function() {
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
  const scope = nock('http://caseinsensitive.com')
    .get('/path')
    .reply(200, 'hey')

  const options = {
    hostname: 'cASEinsensitivE.com',
    path: '/path',
    method: 'GET',
  }

  const req = http.request(options, function(res) {
    scope.done()
    t.end()
  })

  req.end()
})

test('can take a port', t => {
  const scope = nock('http://www.myserver.com:3333')
    .get('/')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      hostname: 'www.myserver.com',
      path: '/',
      port: 3333,
    },
    function(res) {
      t.equal(res.statusCode, 200)
      res.on('end', function() {
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

test('can use https', t => {
  let dataCalled = false

  const scope = nock('https://google.com')
    .get('/')
    .reply(200, 'Hello World!')

  const req = https.request(
    {
      host: 'google.com',
      path: '/',
    },
    function(res) {
      t.equal(res.statusCode, 200)
      res.on('end', function() {
        t.ok(dataCalled, 'data event called')
        scope.done()
        t.end()
      })
      res.on('data', function(data) {
        dataCalled = true
        t.ok(data instanceof Buffer, 'data should be buffer')
        t.equal(data.toString(), 'Hello World!', 'response should match')
      })
    }
  )

  req.end()
})

test('emits error if https route is missing', t => {
  nock('https://google.com')
    .get('/')
    .reply(200, 'Hello World!')

  const req = https.request(
    {
      host: 'google.com',
      path: '/abcdef892932',
    },
    function(res) {
      throw new Error('should not come here!')
    }
  )

  req.end()

  // This listener is intentionally after the end call so make sure that
  // listeners added after the end will catch the error
  req.on('error', function(err) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        { method: 'GET', url: 'https://google.com/abcdef892932' },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('emits error if https route is missing', t => {
  nock('https://google.com:123')
    .get('/')
    .reply(200, 'Hello World!')

  const req = https.request(
    {
      host: 'google.com',
      port: 123,
      path: '/dsadsads',
    },
    function(res) {
      throw new Error('should not come here!')
    }
  )

  req.end()

  // This listener is intentionally after the end call so make sure that
  // listeners added after the end will catch the error
  req.on('error', function(err) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        { method: 'GET', url: 'https://google.com:123/dsadsads' },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('can use ClientRequest using GET', t => {
  let dataCalled = false

  const scope = nock('http://www2.clientrequester.com')
    .get('/dsad')
    .reply(202, 'HEHE!')

  const req = new http.ClientRequest({
    host: 'www2.clientrequester.com',
    path: '/dsad',
  })
  req.end()

  req.on('response', function(res) {
    t.equal(res.statusCode, 202)
    res.on('end', function() {
      t.ok(dataCalled, 'data event was called')
      scope.done()
      t.end()
    })
    res.on('data', function(data) {
      dataCalled = true
      t.ok(data instanceof Buffer, 'data should be buffer')
      t.equal(data.toString(), 'HEHE!', 'response should match')
    })
  })

  req.end()
})

test('can use ClientRequest using POST', t => {
  let dataCalled = false

  const scope = nock('http://www2.clientrequester.com')
    .post('/posthere/please', 'heyhey this is the body')
    .reply(201, 'DOOONE!')

  const req = new http.ClientRequest({
    host: 'www2.clientrequester.com',
    path: '/posthere/please',
    method: 'POST',
  })
  req.write('heyhey this is the body')
  req.end()

  req.on('response', function(res) {
    t.equal(res.statusCode, 201)
    res.on('end', function() {
      t.ok(dataCalled, 'data event was called')
      scope.done()
      t.end()
    })
    res.on('data', function(data) {
      dataCalled = true
      t.ok(data instanceof Buffer, 'data should be buffer')
      t.equal(data.toString(), 'DOOONE!', 'response should match')
    })
  })

  req.end()
})

test('same url matches twice', t => {
  const scope = nock('http://www.twicematcher.com')
    .get('/hey')
    .reply(200, 'First match')
    .get('/hey')
    .reply(201, 'Second match')

  let replied = 0

  function callback() {
    replied += 1
    if (replied == 2) {
      scope.done()
      t.end()
    }
  }

  http.get(
    {
      host: 'www.twicematcher.com',
      path: '/hey',
    },
    function(res) {
      t.equal(res.statusCode, 200)

      res.on('data', function(data) {
        t.equal(
          data.toString(),
          'First match',
          'should match first request response body'
        )
      })

      res.on('end', callback)
    }
  )

  http.get(
    {
      host: 'www.twicematcher.com',
      path: '/hey',
    },
    function(res) {
      t.equal(res.statusCode, 201)

      res.on('data', function(data) {
        t.equal(
          data.toString(),
          'Second match',
          'should match second request response body'
        )
      })

      res.on('end', callback)
    }
  )
})

test('scopes are independent', t => {
  const scope1 = nock('http://www34.google.com')
    .get('/')
    .reply(200, 'Hello World!')
  const scope2 = nock('http://www34.google.com')
    .get('/')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      host: 'www34.google.com',
      path: '/',
      port: 80,
    },
    function(res) {
      res.on('end', function() {
        t.ok(scope1.isDone())
        t.ok(!scope2.isDone()) // fails
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.end()
})

test('two scopes with the same request are consumed', t => {
  nock('http://www36.google.com')
    .get('/')
    .reply(200, 'Hello World!')

  nock('http://www36.google.com')
    .get('/')
    .reply(200, 'Hello World!')

  let doneCount = 0
  function done() {
    doneCount += 1
    if (doneCount == 2) {
      t.end()
    }
  }

  for (let i = 0; i < 2; i += 1) {
    const req = http.request(
      {
        host: 'www36.google.com',
        path: '/',
        port: 80,
      },
      function(res) {
        res.on('end', done)
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.end()
  }
})

test('allow unmocked option works', t => {
  t.plan(7)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')

    switch (url.parse(request.url).pathname) {
      case '/':
        response.writeHead(200)
        response.write('server served a response')
        break
      case '/not/available':
        response.writeHead(404)
        break
      case '/abc':
        response.writeHead(200)
        response.write('server served a response')
        break
    }

    response.end()
  })

  server.listen(() => {
    const scope = nock(`http://localhost:${server.address().port}`, {
      allowUnmocked: true,
    })
      .get('/abc')
      .reply(304, 'served from our mock')
      .get('/wont/get/here')
      .reply(304, 'served from our mock')

    function secondIsDone() {
      t.ok(!scope.isDone())

      http
        .request(
          {
            host: 'localhost',
            path: '/',
            port: server.address().port,
          },
          response => {
            response.destroy()

            t.assert(response.statusCode == 200, 'Do not intercept /')

            server.close(t.end)
          }
        )
        .end()
    }

    function firstIsDone() {
      t.ok(!scope.isDone())

      http
        .request(
          {
            host: 'localhost',
            path: '/not/available',
            port: server.address().port,
          },
          response => {
            t.assert(
              response.statusCode === 404,
              'Server says it does not exist'
            )

            response.on('data', function() {})
            response.on('end', secondIsDone)
          }
        )
        .end()
    }

    const request = http.request(
      {
        host: 'localhost',
        path: '/abc',
        port: server.address().port,
      },
      response => {
        t.assert(response.statusCode == 304, 'Intercept /abc')

        response.on('end', firstIsDone)
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        response.resume()
      }
    )

    request.on('error', t.error)
    request.end()
  })
})

test('default reply headers work', t => {
  nock('http://default.reply.headers.com')
    .defaultReplyHeaders({
      'X-Powered-By': 'Meeee',
      'X-Another-Header': 'Hey man!',
    })
    .get('/')
    .reply(200, '', { A: 'b' })

  function done(res) {
    t.deepEqual(res.headers, {
      'x-powered-by': 'Meeee',
      'x-another-header': 'Hey man!',
      a: 'b',
    })
    t.end()
  }

  http
    .request(
      {
        host: 'default.reply.headers.com',
        path: '/',
      },
      done
    )
    .end()
})

test('default reply headers as functions work', t => {
  const date = new Date().toUTCString()
  const message = 'A message.'

  nock('http://default.reply.headers.com')
    .defaultReplyHeaders({
      'Content-Length': function(req, res, body) {
        return body.length
      },

      Date: function() {
        return date
      },

      Foo: function() {
        return 'foo'
      },
    })
    .get('/')
    .reply(200, message, { foo: 'bar' })

  http
    .request(
      {
        host: 'default.reply.headers.com',
        path: '/',
      },
      function(res) {
        t.deepEqual(res.headers, {
          'content-length': message.length,
          date,
          foo: 'bar',
        })
        t.end()
      }
    )
    .end()
})

test('JSON encoded replies set the content-type header', t => {
  const scope = nock('http://localhost')
    .get('/')
    .reply(200, {
      A: 'b',
    })

  function done(res) {
    scope.done()
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-type'], 'application/json')
    t.end()
  }

  http
    .request(
      {
        host: 'localhost',
        path: '/',
      },
      done
    )
    .end()
})

test('JSON encoded replies does not overwrite existing content-type header', t => {
  const scope = nock('http://localhost')
    .get('/')
    .reply(
      200,
      {
        A: 'b',
      },
      {
        'Content-Type': 'unicorns',
      }
    )

  function done(res) {
    scope.done()
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-type'], 'unicorns')
    t.end()
  }

  http
    .request(
      {
        host: 'localhost',
        path: '/',
      },
      done
    )
    .end()
})

test("blank response doesn't have content-type application/json attached to it", t => {
  nock('http://localhost')
    .get('/')
    .reply(200)

  function done(res) {
    t.equal(res.statusCode, 200)
    t.notEqual(res.headers['content-type'], 'application/json')
    t.end()
  }

  http
    .request(
      {
        host: 'localhost',
        path: '/',
      },
      done
    )
    .end()
})

test('clean all works', t => {
  nock('http://amazon.com')
    .get('/nonexistent')
    .reply(200)

  http.get({ host: 'amazon.com', path: '/nonexistent' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock before cleanup')

    nock.cleanAll()

    http
      .get({ host: 'amazon.com', path: '/nonexistent' }, function(res) {
        res.destroy()
        t.assert(res.statusCode !== 200, 'should clean up properly')
        t.end()
      })
      .on('error', function(err) {
        t.end()
      })
  })
})

test('cleanAll should remove pending mocks from all scopes', t => {
  const scope1 = nock('http://example.org')
    .get('/somepath')
    .reply(200, 'hey')
  t.deepEqual(scope1.pendingMocks(), ['GET http://example.org:80/somepath'])
  const scope2 = nock('http://example.com')
    .get('/somepath')
    .reply(200, 'hey')
  t.deepEqual(scope2.pendingMocks(), ['GET http://example.com:80/somepath'])

  nock.cleanAll()

  t.deepEqual(scope1.pendingMocks(), [])
  t.deepEqual(scope2.pendingMocks(), [])
  t.end()
})

test('is done works', t => {
  nock('http://amazon.com')
    .get('/nonexistent')
    .reply(200)

  t.ok(!nock.isDone())

  http.get({ host: 'amazon.com', path: '/nonexistent' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock before cleanup')
    t.ok(nock.isDone())
    t.end()
  })
})

test('pending mocks works', t => {
  nock('http://amazon.com')
    .get('/nonexistent')
    .reply(200)

  t.deepEqual(nock.pendingMocks(), ['GET http://amazon.com:80/nonexistent'])

  http.get({ host: 'amazon.com', path: '/nonexistent' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock before cleanup')
    t.deepEqual(nock.pendingMocks(), [])
    t.end()
  })
})

test("pending mocks doesn't include optional mocks", t => {
  nock('http://example.com')
    .get('/nonexistent')
    .optionally()
    .reply(200)

  t.deepEqual(nock.pendingMocks(), [])
  t.end()
})

test('calling optionally(true) on a mock makes it optional', t => {
  nock('http://example.com')
    .get('/nonexistent')
    .optionally(true)
    .reply(200)

  t.deepEqual(nock.pendingMocks(), [])
  t.end()
})

test('calling optionally(false) on a mock leaves it as required', t => {
  nock('http://example.com')
    .get('/nonexistent')
    .optionally(false)
    .reply(200)

  t.notEqual(nock.pendingMocks(), [])
  nock.cleanAll()
  t.end()
})

test('optional mocks are still functional', t => {
  nock('http://example.com')
    .get('/abc')
    .optionally()
    .reply(200)

  http.get({ host: 'example.com', path: '/abc' }, function(res) {
    t.assert(res.statusCode === 200, 'should still mock requests')
    t.deepEqual(nock.pendingMocks(), [])
    t.end()
  })
})

test('isDone is true with optional mocks outstanding', t => {
  const scope = nock('http://example.com')
    .get('/abc')
    .optionally()
    .reply(200)

  t.ok(scope.isDone())
  t.end()
})

test('optional but persisted mocks persist, but never appear as pending', t => {
  nock('http://example.com')
    .get('/123')
    .optionally()
    .reply(200)
    .persist()

  t.deepEqual(nock.pendingMocks(), [])
  http.get({ host: 'example.com', path: '/123' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock first request')
    t.deepEqual(nock.pendingMocks(), [])

    http.get({ host: 'example.com', path: '/123' }, function(res) {
      t.assert(res.statusCode === 200, 'should mock second request')
      t.deepEqual(nock.pendingMocks(), [])
      t.end()
    })
  })
})

test('optional repeated mocks execute repeatedly, but never appear as pending', t => {
  nock('http://example.com')
    .get('/456')
    .optionally()
    .times(2)
    .reply(200)

  t.deepEqual(nock.pendingMocks(), [])
  http.get({ host: 'example.com', path: '/456' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock first request')
    t.deepEqual(nock.pendingMocks(), [])

    http.get({ host: 'example.com', path: '/456' }, function(res) {
      t.assert(res.statusCode === 200, 'should mock second request')
      t.deepEqual(nock.pendingMocks(), [])
      t.end()
    })
  })
})

test("activeMocks returns optional mocks only before they're completed", t => {
  nock.cleanAll()
  nock('http://example.com')
    .get('/optional')
    .optionally()
    .reply(200)

  t.deepEqual(nock.activeMocks(), ['GET http://example.com:80/optional'])
  http.get({ host: 'example.com', path: '/optional' }, function(res) {
    t.deepEqual(nock.activeMocks(), [])
    t.end()
  })
})

test('activeMocks always returns persisted mocks', t => {
  nock.cleanAll()
  nock('http://example.com')
    .get('/persisted')
    .reply(200)
    .persist()

  t.deepEqual(nock.activeMocks(), ['GET http://example.com:80/persisted'])
  http.get({ host: 'example.com', path: '/persisted' }, function(res) {
    t.deepEqual(nock.activeMocks(), ['GET http://example.com:80/persisted'])
    t.end()
  })
})

test('activeMocks returns incomplete mocks', t => {
  nock.cleanAll()
  nock('http://example.com')
    .get('/incomplete')
    .reply(200)

  t.deepEqual(nock.activeMocks(), ['GET http://example.com:80/incomplete'])
  t.end()
})

test("activeMocks doesn't return completed mocks", t => {
  nock.cleanAll()
  nock('http://example.com')
    .get('/complete-me')
    .reply(200)

  http.get({ host: 'example.com', path: '/complete-me' }, function(res) {
    t.deepEqual(nock.activeMocks(), [])
    t.end()
  })
})

test('username and password works', t => {
  const scope = nock('http://passwordyy.com')
    .get('/')
    .reply(200, 'Welcome, username')

  http
    .request(
      {
        hostname: 'passwordyy.com',
        auth: 'username:password',
        path: '/',
      },
      function(res) {
        scope.done()
        t.end()
      }
    )
    .end()
})

test('works with mikeal/request and username and password', t => {
  const scope = nock('http://passwordyyyyy.com')
    .get('/abc')
    .reply(200, 'Welcome, username')

  mikealRequest(
    { uri: 'http://username:password@passwordyyyyy.com/abc', log: true },
    function(err, res, body) {
      t.ok(!err, 'error')
      t.ok(scope.isDone())
      t.equal(body, 'Welcome, username')
      t.end()
    }
  )
})

test('different ports work works', t => {
  const scope = nock('http://abc.portyyyy.com:8081')
    .get('/pathhh')
    .reply(200, 'Welcome, username')

  http
    .request(
      {
        hostname: 'abc.portyyyy.com',
        port: 8081,
        path: '/pathhh',
      },
      function(res) {
        scope.done()
        t.end()
      }
    )
    .end()
})

test('different ports work work with Mikeal request', t => {
  const scope = nock('http://abc.portyyyy.com:8082')
    .get('/pathhh')
    .reply(200, 'Welcome to Mikeal Request!')

  mikealRequest.get('http://abc.portyyyy.com:8082/pathhh', function(
    err,
    res,
    body
  ) {
    t.ok(!err, 'no error')
    t.equal(body, 'Welcome to Mikeal Request!')
    t.ok(scope.isDone())
    t.end()
  })
})

test('explicitly specifiying port 80 works', t => {
  const scope = nock('http://abc.portyyyy.com:80')
    .get('/pathhh')
    .reply(200, 'Welcome, username')

  http
    .request(
      {
        hostname: 'abc.portyyyy.com',
        port: 80,
        path: '/pathhh',
      },
      function(res) {
        scope.done()
        t.end()
      }
    )
    .end()
})

test('post with object', t => {
  const scope = nock('http://uri')
    .post('/claim', { some_data: 'something' })
    .reply(200)

  http
    .request(
      {
        hostname: 'uri',
        port: 80,
        method: 'POST',
        path: '/claim',
      },
      function(res) {
        scope.done()
        t.end()
      }
    )
    .end('{"some_data":"something"}')
})

test('accept string as request target', t => {
  let dataCalled = false
  const scope = nock('http://www.example.com')
    .get('/')
    .reply(200, 'Hello World!')

  http.get('http://www.example.com', function(res) {
    t.equal(res.statusCode, 200)

    res.on('data', function(data) {
      dataCalled = true
      t.ok(data instanceof Buffer, 'data should be buffer')
      t.equal(data.toString(), 'Hello World!', 'response should match')
    })

    res.on('end', function() {
      t.ok(dataCalled)
      scope.done()
      t.end()
    })
  })
})

if (url.URL) {
  test('accept URL as request target', t => {
    let dataCalled = false
    const scope = nock('http://www.example.com')
      .get('/')
      .reply(200, 'Hello World!')

    http.get(new url.URL('http://www.example.com'), function(res) {
      t.equal(res.statusCode, 200)

      res.on('data', function(data) {
        dataCalled = true
        t.ok(data instanceof Buffer, 'data should be buffer')
        t.equal(data.toString(), 'Hello World!', 'response should match')
      })

      res.on('end', function() {
        t.ok(dataCalled)
        scope.done()
        t.end()
      })
    })
  })
}

test('request has path', t => {
  const scope = nock('http://haspath.com')
    .get('/the/path/to/infinity')
    .reply(200)

  const req = http.request(
    {
      hostname: 'haspath.com',
      port: 80,
      method: 'GET',
      path: '/the/path/to/infinity',
    },
    function(res) {
      scope.done()
      t.equal(
        req.path,
        '/the/path/to/infinity',
        'should have req.path set to /the/path/to/infinity'
      )
      t.end()
    }
  )
  req.end()
})

test('persists interceptors', t => {
  const scope = nock('http://persisssists.con')
    .persist()
    .get('/')
    .reply(200, 'Persisting all the way')

  t.ok(!scope.isDone())
  http
    .get('http://persisssists.con/', function(res) {
      t.ok(scope.isDone())
      http
        .get('http://persisssists.con/', function(res) {
          t.ok(scope.isDone())
          t.end()
        })
        .end()
    })
    .end()
})

test('Persisted interceptors are in pendingMocks initially', t => {
  const scope = nock('http://example.com')
    .get('/abc')
    .reply(200, 'Persisted reply')
    .persist()

  t.deepEqual(scope.pendingMocks(), ['GET http://example.com:80/abc'])
  t.end()
})

test('Persisted interceptors are not in pendingMocks after the first request', t => {
  const scope = nock('http://example.com')
    .get('/def')
    .reply(200, 'Persisted reply')
    .persist()

  http.get('http://example.com/def', function(res) {
    t.deepEqual(scope.pendingMocks(), [])
    t.end()
  })
})

test('persist reply with file', t => {
  nock('http://www.filereplier.com')
    .persist()
    .get('/')
    .replyWithFile(200, `${__dirname}/../assets/reply_file_1.txt`)
    .get('/test')
    .reply(200, 'Yay!')

  async.each(
    [1, 2],
    function(_, cb) {
      let dataCalled = false
      const req = http.request(
        {
          host: 'www.filereplier.com',
          path: '/',
          port: 80,
        },
        function(res) {
          t.equal(res.statusCode, 200)
          res.once('end', function() {
            t.ok(dataCalled)
            cb()
          })
          res.on('data', function(data) {
            dataCalled = true
            t.equal(
              data.toString(),
              'Hello from the file!',
              'response should match'
            )
          })
        }
      )
      req.end()
    },
    t.end.bind(t)
  )
})

test('(re-)activate after restore', t => {
  t.plan(7)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')

    switch (url.parse(request.url).pathname) {
      case '/':
        response.writeHead(200)
        response.write('server served a response')
        break
    }

    response.end()
  })

  server.listen(() => {
    const scope = nock(`http://localhost:${server.address().port}`)
      .get('/')
      .reply(304, 'served from our mock')

    nock.restore()
    t.false(nock.isActive())

    http.get(`http://localhost:${server.address().port}`, function(res) {
      res.resume()

      t.is(200, res.statusCode)

      res.on('end', function() {
        t.ok(!scope.isDone())

        nock.activate()
        t.true(nock.isActive())
        http.get(`http://localhost:${server.address().port}`, function(res) {
          res.resume()

          t.is(304, res.statusCode)

          res.on('end', function() {
            t.ok(scope.isDone())

            server.close(t.end)
          })
        })
      })
    })
  })
})

test('allow unmocked option works with https', t => {
  t.plan(6)

  function middleware(request, response) {
    if (request.url === '/does/not/exist') {
      response.writeHead(404)
      response.end()
      return
    }

    response.writeHead(200)
    response.end()
  }

  ssl.startServer(middleware, function(error, server) {
    t.error(error)

    const { port } = server.address()
    const requestOptions = {
      host: 'localhost',
      port,
      ca: ssl.ca,
    }

    const scope = nock(`https://localhost:${port}`, { allowUnmocked: true })
      .get('/abc')
      .reply(200, 'Hey!')
      .get('/wont/get/here')
      .reply(200, 'Hi!')

    function secondIsDone() {
      t.ok(!scope.isDone())
      https
        .request(Object.assign({ path: '/' }, requestOptions), res => {
          res.resume()
          t.ok(true, 'Google replied to /')
          res.destroy()
          t.assert(
            res.statusCode < 400 && res.statusCode >= 200,
            'GET Google Home page'
          )

          server.close(t.end)
        })
        .end()
    }

    function firstIsDone() {
      t.ok(!scope.isDone(), 'scope is not done')
      https
        .request(
          Object.assign({ path: '/does/not/exist' }, requestOptions),
          res => {
            t.equal(404, res.statusCode, 'real google response status code')
            res.on('data', function() {})
            res.on('end', secondIsDone)
          }
        )
        .end()
    }

    https
      .request(Object.assign({ path: '/abc' }, requestOptions), res => {
        res.on('end', firstIsDone)
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      })
      .end()
  })
})

test('allow unmocked post with json data', t => {
  t.plan(2)
  t.once('end', function() {
    server.close()
  })

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })

  server.listen(() => {
    nock(`http://localhost:${server.address().port}`, { allowUnmocked: true })
      .get('/')
      .reply(200, 'Hey!')

    const options = {
      method: 'POST',
      uri: `http://localhost:${server.address().port}`,
      json: { some: 'data' },
    }

    mikealRequest(options, function(err, resp, body) {
      t.equal(200, resp.statusCode)
      t.end()
    })
  })
})

test('allow unmocked passthrough with mismatched bodies', t => {
  t.plan(2)
  t.once('end', function() {
    server.close()
  })

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })

  server.listen(() => {
    nock(`http://localhost:${server.address().port}`, { allowUnmocked: true })
      .post('/post', { some: 'otherdata' })
      .reply(404, 'Hey!')

    const options = {
      method: 'POST',
      uri: `http://localhost:${server.address().port}/post`,
      json: { some: 'data' },
    }

    mikealRequest(options, function(err, resp, body) {
      t.equal(200, resp.statusCode)
      t.end()
    })
  })
})

test('allow unordered body with json encoding', t => {
  const scope = nock('http://wtfjs.org')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo',
    })
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://wtfjs.org/like-wtf',
      method: 'POST',
      json: {
        bar: 'foo',
        foo: 'bar',
      },
    },
    function(e, r, body) {
      t.equal(body, 'Heyyyy!')
      scope.done()
      t.end()
    }
  )
})

test('allow unordered body with form encoding', t => {
  const scope = nock('http://wtfjs.org')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo',
    })
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://wtfjs.org/like-wtf',
      method: 'POST',
      form: {
        bar: 'foo',
        foo: 'bar',
      },
    },
    function(e, r, body) {
      t.equal(body, 'Heyyyy!')
      scope.done()
      t.end()
    }
  )
})

test('allow string json spec', t => {
  const bodyObject = { bar: 'foo', foo: 'bar' }

  const scope = nock('http://wtfjs.org')
    .post('/like-wtf', JSON.stringify(bodyObject))
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://wtfjs.org/like-wtf',
      method: 'POST',
      json: {
        bar: 'foo',
        foo: 'bar',
      },
    },
    function(e, r, body) {
      t.equal(body, 'Heyyyy!')
      scope.done()
      t.end()
    }
  )
})

test('has a req property on the response', t => {
  const scope = nock('http://wtfjs.org')
    .get('/like-wtf')
    .reply(200)
  const req = http.request('http://wtfjs.org/like-wtf', function(res) {
    res.on('end', function() {
      t.ok(res.req, "req property doesn't exist")
      scope.done()
      t.end()
    })
    // Streams start in 'paused' mode and must be started.
    // See https://nodejs.org/api/stream.html#stream_class_stream_readable
    res.resume()
  })
  req.end()
})

test('disabled real HTTP request', t => {
  nock.disableNetConnect()

  http
    .get('http://www.amazon.com', function(res) {
      throw 'should not request this'
    })
    .on('error', function(err) {
      t.equal(
        err.message,
        'Nock: Disallowed net connect for "www.amazon.com:80/"'
      )
      t.end()
    })

  nock.enableNetConnect()
})

test('NetConnectNotAllowedError is instance of Error', t => {
  nock.disableNetConnect()

  http
    .get('http://www.amazon.com', function(res) {
      throw 'should not request this'
    })
    .on('error', function(err) {
      t.type(err, 'Error')
      t.end()
    })

  nock.enableNetConnect()
})

test('NetConnectNotAllowedError exposes the stack and has a code', t => {
  nock.disableNetConnect()

  http
    .get('http://www.amazon.com', function(res) {
      throw 'should not request this'
    })
    .on('error', function(err) {
      t.equal(err.code, 'ENETUNREACH')
      t.notEqual(err.stack, undefined)
      t.end()
    })

  nock.enableNetConnect()
})

test('enable real HTTP request only for specified domain, via string', t => {
  t.plan(1)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
    t.end()
  })
  t.once('end', () => server.close())

  nock.enableNetConnect('localhost')
  t.once('end', () => nock.enableNetConnect())

  server.listen(() =>
    mikealRequest(`http://localhost:${server.address().port}/`)
  )
})

test('disallow request for other domains, via string', t => {
  nock.enableNetConnect('localhost')
  t.once('end', () => nock.enableNetConnect())

  http
    .get('http://www.amazon.com', function(res) {
      throw 'should not deliver this request'
    })
    .on('error', function(err) {
      t.equal(
        err.message,
        'Nock: Disallowed net connect for "www.amazon.com:80/"'
      )
      t.end()
    })
})

test('enable real HTTP request only for specified domain, via regexp', t => {
  t.plan(1)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
    t.end()
  })
  t.once('end', () => server.close())

  nock.enableNetConnect(/ocalhos/)
  t.once('end', () => nock.enableNetConnect())

  server.listen(() =>
    mikealRequest(`http://localhost:${server.address().port}/`)
  )
})

test('disallow request for other domains, via regexp', t => {
  nock.enableNetConnect(/ocalhos/)
  t.once('end', () => nock.enableNetConnect())

  http
    .get('http://www.amazon.com', function(res) {
      throw 'should not deliver this request'
    })
    .on('error', function(err) {
      t.equal(
        err.message,
        'Nock: Disallowed net connect for "www.amazon.com:80/"'
      )
      t.end()
    })
})

test('repeating once', t => {
  nock.disableNetConnect()

  nock('http://zombo.com')
    .get('/')
    .once()
    .reply(200, 'Hello World!')

  http.get('http://zombo.com', function(res) {
    t.equal(200, res.statusCode, 'first request')
    t.end()
  })

  nock.cleanAll()

  nock.enableNetConnect()
})

test('repeating twice', t => {
  nock.disableNetConnect()

  nock('http://zombo.com')
    .get('/')
    .twice()
    .reply(200, 'Hello World!')

  async.each(
    [1, 2],
    function(_, cb) {
      http.get('http://zombo.com', function(res) {
        t.equal(200, res.statusCode)
        cb()
      })
    },
    t.end.bind(t)
  )
})

test('repeating thrice', t => {
  nock.disableNetConnect()

  nock('http://zombo.com')
    .get('/')
    .thrice()
    .reply(200, 'Hello World!')

  async.each(
    [1, 2, 3],
    function(_, cb) {
      http.get('http://zombo.com', function(res) {
        t.equal(200, res.statusCode)
        cb()
      })
    },
    t.end.bind(t)
  )
})

test('repeating response 4 times', t => {
  nock.disableNetConnect()

  nock('http://zombo.com')
    .get('/')
    .times(4)
    .reply(200, 'Hello World!')

  async.each(
    [1, 2, 3, 4],
    function(_, cb) {
      http.get('http://zombo.com', function(res) {
        t.equal(200, res.statusCode, 'first request')
        cb()
      })
    },
    t.end.bind(t)
  )
})

test('superagent works', t => {
  const responseText = 'Yay superagent!'
  const headers = { 'Content-Type': 'text/plain' }
  nock('http://superagent.cz')
    .get('/somepath')
    .reply(200, responseText, headers)

  superagent.get('http://superagent.cz/somepath').end(function(err, res) {
    t.equal(res.text, responseText)
    t.end()
  })
})

test('superagent works with query string', t => {
  const responseText = 'Yay superagentzzz'
  const headers = { 'Content-Type': 'text/plain' }
  nock('http://superagent.cz')
    .get('/somepath?a=b')
    .reply(200, responseText, headers)

  superagent.get('http://superagent.cz/somepath?a=b').end(function(err, res) {
    t.equal(res.text, responseText)
    t.end()
  })
})

test('superagent posts', t => {
  nock('http://superagent.cz')
    .post('/somepath?b=c')
    .reply(204)

  superagent
    .post('http://superagent.cz/somepath?b=c')
    .send('some data')
    .end(function(err, res) {
      t.equal(res.status, 204)
      t.end()
    })
})

test('response is streams2 compatible', t => {
  const responseText = 'streams2 streams2 streams2'
  nock('http://stream2hostnameftw')
    .get('/somepath')
    .reply(200, responseText)

  http
    .request(
      {
        host: 'stream2hostnameftw',
        path: '/somepath',
      },
      function(res) {
        res.setEncoding('utf8')

        let body = ''

        res.on('readable', function() {
          let buf
          while ((buf = res.read())) body += buf
        })

        res.once('end', function() {
          t.equal(body, responseText)
          t.end()
        })
      }
    )
    .end()
})

test('response is an http.IncomingMessage instance', t => {
  const responseText = 'incoming message!'
  nock('http://example.com')
    .get('/somepath')
    .reply(200, responseText)

  http
    .request(
      {
        host: 'example.com',
        path: '/somepath',
      },
      function(res) {
        res.resume()
        t.true(res instanceof http.IncomingMessage)
        t.end()
      }
    )
    .end()
})

function checkDuration(t, ms) {
  // Do not write new tests using this function. Write async tests using
  // `resolvesInAtLeast` instead.
  const _end = t.end
  const start = process.hrtime()
  let ended = false
  t.end = function() {
    if (ended) return
    ended = true
    const fin = process.hrtime(start)
    const finMs =
      fin[0] * 1000 + // seconds -> ms
      fin[1] * 1e-6 // nanoseconds -> ms

    /// innaccurate timers
    ms = ms * 0.9

    t.ok(
      finMs >= ms,
      `Duration of ${Math.round(finMs)}ms should be longer than ${ms}ms`
    )
    _end.call(t)
  }
}

async function resolvesInAtLeast(t, fn, durationMillis) {
  const startTime = process.hrtime()

  await fn()

  const [seconds, nanoseconds] = process.hrtime(startTime)
  const elapsedTimeMillis = seconds * 1000 + nanoseconds * 1e-6

  t.ok(
    elapsedTimeMillis >= durationMillis,
    `Duration of ${Math.round(
      elapsedTimeMillis
    )} ms should be at least ${durationMillis} ms`
  )
}

test('calling delay could cause mikealRequest timeout error', t => {
  const scope = nock('http://funk')
    .get('/')
    .delay({
      head: 300,
    })
    .reply(200, 'OK')

  mikealRequest(
    {
      uri: 'http://funk',
      method: 'GET',
      timeout: 100,
    },
    function(err) {
      scope.done()
      t.equal(err && err.code, 'ESOCKETTIMEDOUT')
      t.end()
    }
  )
})

test('Body delay does not have impact on timeout', t => {
  const scope = nock('http://funk')
    .get('/')
    .delay({
      head: 300,
      body: 300,
    })
    .reply(200, 'OK')

  mikealRequest(
    {
      uri: 'http://funk',
      method: 'GET',
      timeout: 500,
    },
    function(err, r, body) {
      t.equal(err, null)
      t.equal(body, 'OK')
      t.equal(r.statusCode, 200)
      scope.done()
      t.end()
    }
  )
})

test('calling delay with "body" and "head" delays the response', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 600)

  nock('http://funk')
    .get('/')
    .delay({
      head: 300,
      body: 300,
    })
    .reply(200, 'OK')

  http.get('http://funk/', function(res) {
    res.once('data', function(data) {
      t.equal(data.toString(), 'OK')
      res.once('end', t.end.bind(t))
    })
  })
})

test('calling delay with "body" delays the response body', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://funk')
    .get('/')
    .delay({
      body: 100,
    })
    .reply(200, 'OK')

  http.get('http://funk/', function(res) {
    res.setEncoding('utf8')

    let body = ''

    res.on('data', function(chunk) {
      body += chunk
    })

    res.once('end', function() {
      t.equal(body, 'OK')
      t.end()
    })
  })
})

test('calling delayBody delays the response', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://funk')
    .get('/')
    .delayBody(100)
    .reply(200, 'OK')

  http.get('http://funk/', function(res) {
    res.setEncoding('utf8')

    let body = ''

    res.on('data', function(chunk) {
      body += chunk
    })

    res.once('end', function() {
      t.equal(body, 'OK')
      t.end()
    })
  })
})

test('calling delay delays the response', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://funk')
    .get('/')
    .delay(100)
    .reply(200, 'OK')

  http.get('http://funk/', function(res) {
    res.setEncoding('utf8')

    let body = ''

    res.on('data', function(chunk) {
      body += chunk
    })

    res.once('end', function() {
      t.equal(body, 'OK')
      t.end()
    })
  })
})

test('using reply callback with delay provides proper arguments', t => {
  nock('http://localhost')
    .get('/')
    .delay(100)
    .reply(200, function(path, requestBody) {
      t.equal(path, '/', 'path arg should be set')
      t.equal(requestBody, 'OK', 'requestBody arg should be set')
      t.end()
    })

  http.request('http://localhost/', function() {}).end('OK')
})

test('using reply callback with delay can reply JSON', t => {
  nock('http://delayfunctionreplyjson')
    .get('/')
    .delay(100)
    .reply(200, function(path, requestBody) {
      return { a: 1 }
    })

  mikealRequest.get(
    {
      url: 'http://delayfunctionreplyjson/',
      json: true,
    },
    function(err, res, body) {
      t.equals(res.headers['content-type'], 'application/json')
      t.deepEqual(body, { a: 1 })
      t.end()
    }
  )
})

test('delay works with replyWithFile', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delay(100)
    .replyWithFile(200, `${__dirname}/../assets/reply_file_1.txt`)

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('delay works with when you return a generic stream from the reply callback', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delay(100)
    .reply(200, function(path, reqBody) {
      return fs.createReadStream(`${__dirname}/../assets/reply_file_1.txt`)
    })

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('delay with replyWithError: response is delayed', async t => {
  nock('http://errorland')
    .get('/')
    .delay(100)
    .replyWithError('this is an error message')

  await resolvesInAtLeast(
    t,
    async () =>
      t.rejects(() => got('http://errorland/'), {
        message: 'this is an error message',
      }),
    100
  )
})

test('write callback called', t => {
  const scope = nock('http://www.filterboddiezregexp.com')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  let callbackCalled = false
  const req = http.request(
    {
      host: 'www.filterboddiezregexp.com',
      method: 'POST',
      path: '/',
      port: 80,
    },
    function(res) {
      t.equal(callbackCalled, true)
      t.equal(res.statusCode, 200)
      res.on('end', function() {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.write('mamma mia', null, function() {
    callbackCalled = true
    req.end()
  })
})

test('end callback called', t => {
  const scope = nock('http://www.filterboddiezregexp.com')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  let callbackCalled = false
  const req = http.request(
    {
      host: 'www.filterboddiezregexp.com',
      method: 'POST',
      path: '/',
      port: 80,
    },
    function(res) {
      t.equal(callbackCalled, true)
      t.equal(res.statusCode, 200)
      res.on('end', function() {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.end('mamma mia', null, function() {
    callbackCalled = true
  })
})

test('finish event fired before end event (bug-139)', t => {
  const scope = nock('http://www.filterboddiezregexp.com')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  let finishCalled = false
  const req = http.request(
    {
      host: 'www.filterboddiezregexp.com',
      method: 'POST',
      path: '/',
      port: 80,
    },
    function(res) {
      t.equal(finishCalled, true)
      t.equal(res.statusCode, 200)
      res.on('end', function() {
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.on('finish', function() {
    finishCalled = true
  })

  req.end('mamma mia')
})

test(
  'when a stream is used for the response body, it will not be read until after the response event',
  { skip: !stream.Readable },
  t => {
    let responseEvent = false
    const text = 'Hello World\n'

    function SimpleStream(opt) {
      stream.Readable.call(this, opt)
    }
    util.inherits(SimpleStream, stream.Readable)
    SimpleStream.prototype._read = function() {
      t.ok(responseEvent)
      this.push(text)
      this.push(null)
    }

    nock('http://localhost')
      .get('/')
      .reply(200, function(path, reqBody) {
        return new SimpleStream()
      })

    http.get('http://localhost/', function(res) {
      responseEvent = true
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(body, text)
        t.end()
      })
    })
  }
)

test('calling delayConnection delays the connection', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://funk')
    .get('/')
    .delayConnection(100)
    .reply(200, 'OK')

  http.get('http://funk/', function(res) {
    res.setEncoding('utf8')

    let body = ''

    res.on('data', function(chunk) {
      body += chunk
    })

    res.once('end', function() {
      t.equal(body, 'OK')
      t.end()
    })
  })
})

test('using reply callback with delayConnection provides proper arguments', t => {
  nock('http://localhost')
    .get('/')
    .delayConnection(100)
    .reply(200, function(path, requestBody) {
      t.equal(path, '/', 'path arg should be set')
      t.equal(requestBody, 'OK', 'requestBody arg should be set')
      t.end()
    })

  http.request('http://localhost/', function() {}).end('OK')
})

test('delayConnection works with replyWithFile', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delayConnection(100)
    .replyWithFile(200, `${__dirname}/../assets/reply_file_1.txt`)

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('delayConnection works with when you return a generic stream from the reply callback', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delayConnection(100)
    .reply(200, function(path, reqBody) {
      return fs.createReadStream(`${__dirname}/../assets/reply_file_1.txt`)
    })

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('define() is backward compatible', t => {
  const nockDef = {
    scope: 'http://example.com',
    //  "port" has been deprecated
    port: 12345,
    method: 'GET',
    path: '/',
    //  "reply" has been deprected
    reply: '500',
  }

  const nocks = nock.define([nockDef])

  t.ok(nocks)

  const req = new http.request(
    {
      host: 'example.com',
      port: nockDef.port,
      method: nockDef.method,
      path: nockDef.path,
    },
    function(res) {
      t.equal(res.statusCode, 500)

      res.once('end', function() {
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.on('error', function(err) {
    //  This should never happen.
    t.ok(false, 'Error should never occur.')
    t.end()
  })

  req.end()
})

test('define() works with non-JSON responses', t => {
  const nockDef = {
    scope: 'http://example.com',
    method: 'POST',
    path: '/',
    body: '�',
    status: 200,
    response: '�',
  }

  const nocks = nock.define([nockDef])

  t.ok(nocks)

  const req = new http.request(
    {
      host: 'example.com',
      method: nockDef.method,
      path: nockDef.path,
    },
    function(res) {
      t.equal(res.statusCode, nockDef.status)

      const dataChunks = []

      res.on('data', function(chunk) {
        dataChunks.push(chunk)
      })

      res.once('end', function() {
        const response = Buffer.concat(dataChunks)
        t.equal(response.toString('utf8'), nockDef.response, 'responses match')
        t.end()
      })
    }
  )

  req.on('error', function(err) {
    //  This should never happen.
    t.ok(false, 'Error should never occur.')
    t.end()
  })

  req.write(nockDef.body)
  req.end()
})

test('define() works with binary buffers', t => {
  const nockDef = {
    scope: 'http://example.com',
    method: 'POST',
    path: '/',
    body: '8001',
    status: 200,
    response: '8001',
  }

  const nocks = nock.define([nockDef])

  t.ok(nocks)

  const req = new http.request(
    {
      host: 'example.com',
      method: nockDef.method,
      path: nockDef.path,
    },
    function(res) {
      t.equal(res.statusCode, nockDef.status)

      const dataChunks = []

      res.on('data', function(chunk) {
        dataChunks.push(chunk)
      })

      res.once('end', function() {
        const response = Buffer.concat(dataChunks)
        t.equal(response.toString('hex'), nockDef.response, 'responses match')
        t.end()
      })
    }
  )

  req.on('error', function(err) {
    //  This should never happen.
    t.ok(false, 'Error should never occur.')
    t.end()
  })

  req.write(Buffer.from(nockDef.body, 'hex'))
  req.end()
})

test('define() uses reqheaders', t => {
  const auth = 'foo:bar'
  const authHeader = `Basic ${Buffer.from('foo:bar').toString('base64')}`

  const nockDef = {
    scope: 'http://example.com',
    method: 'GET',
    path: '/',
    status: 200,
    reqheaders: {
      host: 'example.com',
      authorization: authHeader,
    },
  }

  const nocks = nock.define([nockDef])

  t.ok(nocks)

  // Make a request which should match the mock that was configured above.
  // This does not hit the network.
  const req = new http.request(
    {
      host: 'example.com',
      method: nockDef.method,
      path: nockDef.path,
      auth,
    },
    function(res) {
      t.equal(res.statusCode, nockDef.status)

      res.once('end', function() {
        t.equivalent(res.req._headers, nockDef.reqheaders)
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )
  req.end()
})

test('define() uses badheaders', t => {
  const nockDef = [
    {
      scope: 'http://example.com',
      method: 'GET',
      path: '/',
      status: 401,
      badheaders: ['x-foo'],
    },
    {
      scope: 'http://example.com',
      method: 'GET',
      path: '/',
      status: 200,
      reqheaders: {
        'x-foo': 'bar',
      },
    },
  ]

  const nocks = nock.define(nockDef)

  t.ok(nocks)

  const req = new http.request(
    {
      host: 'example.com',
      method: 'GET',
      path: '/',
      headers: {
        'x-foo': 'bar',
      },
    },
    function(res) {
      t.equal(res.statusCode, 200)

      res.once('end', function() {
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )
  req.end()
})

test('sending binary and receiving JSON should work ', t => {
  const scope = nock('http://example.com')
    .filteringRequestBody(/.*/, '*')
    .post('/some/path', '*')
    .reply(
      201,
      { foo: '61' },
      {
        'Content-Type': 'application/json',
      }
    )

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.com/some/path',
      body: Buffer.from('ffd8ffe000104a46494600010101006000600000ff', 'hex'),
      headers: { Accept: 'application/json', 'Content-Length': 23861 },
    },
    function(err, res, body) {
      scope.done()

      t.equal(res.statusCode, 201)
      t.equal(body.length, 12)

      let json
      try {
        json = JSON.parse(body)
      } catch (e) {
        json = {}
      }

      t.equal(json.foo, '61')
      t.end()
    }
  )
})

// https://github.com/nock/nock/issues/146
test('resume() is automatically invoked when the response is drained', t => {
  const replyLength = 1024 * 1024
  const replyBuffer = Buffer.from(new Array(replyLength + 1).join('.'))
  t.equal(replyBuffer.length, replyLength)

  nock('http://www.abc.com')
    .get('/abc')
    .reply(200, replyBuffer)

  needle.get('http://www.abc.com/abc', function(err, res, buffer) {
    t.notOk(err)
    t.ok(res)
    t.ok(buffer)
    t.same(buffer, replyBuffer)
    t.end()
  })
})

test('handles get with restify client', t => {
  const scope = nock('https://www.example.com')
    .get('/get')
    .reply(200, 'get')

  const client = restify.createClient({
    url: 'https://www.example.com',
  })

  client.get('/get', function(err, req, res) {
    req.on('result', function(err, res) {
      res.body = ''
      res.setEncoding('utf8')
      res.on('data', function(chunk) {
        res.body += chunk
      })

      res.on('end', function() {
        t.equal(res.body, 'get')
        t.end()
        scope.done()
      })
    })
  })
})

test('handles post with restify client', t => {
  const scope = nock('https://www.example.com')
    .post('/post', 'hello world')
    .reply(200, 'post')

  const client = restify.createClient({
    url: 'https://www.example.com',
  })

  client.post('/post', function(err, req, res) {
    req.on('result', function(err, res) {
      res.body = ''
      res.setEncoding('utf8')
      res.on('data', function(chunk) {
        res.body += chunk
      })

      res.on('end', function() {
        t.equal(res.body, 'post')
        t.end()
        scope.done()
      })
    })

    req.write('hello world')
    req.end()
  })
})

test('handles get with restify JsonClient', t => {
  const scope = nock('https://www.example.com')
    .get('/get')
    .reply(200, { get: 'ok' })

  const client = restify.createJsonClient({
    url: 'https://www.example.com',
  })

  client.get('/get', function(err, req, res, obj) {
    t.equal(obj.get, 'ok')
    t.end()
    scope.done()
  })
})

test('handles post with restify JsonClient', t => {
  const scope = nock('https://www.example.com')
    .post('/post', { username: 'banana' })
    .reply(200, { post: 'ok' })

  const client = restify.createJsonClient({
    url: 'https://www.example.com',
  })

  client.post('/post', { username: 'banana' }, function(err, req, res, obj) {
    t.equal(obj.post, 'ok')
    t.end()
    scope.done()
  })
})

test('handles 404 with restify JsonClient', t => {
  const scope = nock('https://www.example.com')
    .put('/404')
    .reply(404)

  const client = restify.createJsonClient({
    url: 'https://www.example.com',
  })

  client.put('/404', function(err, req, res, obj) {
    t.equal(res.statusCode, 404)
    t.end()
    scope.done()
  })
})

test('handles 500 with restify JsonClient', t => {
  const scope = nock('https://www.example.com')
    .delete('/500')
    .reply(500)

  const client = restify.createJsonClient({
    url: 'https://www.example.com',
  })

  client.del('/500', function(err, req, res, obj) {
    t.equal(res.statusCode, 500)
    t.end()
    scope.done()
  })
})

test('test request timeout option', t => {
  nock('http://example.com')
    .get('/test')
    .reply(200, JSON.stringify({ foo: 'bar' }))

  const options = {
    url: 'http://example.com/test',
    method: 'GET',
    timeout: 2000,
  }

  mikealRequest(options, function(err, res, body) {
    t.strictEqual(err, null)
    t.equal(body, '{"foo":"bar"}')
    t.end()
  })
})

test('done fails when specified request header is missing', t => {
  nock('http://example.com', {
    reqheaders: {
      'X-App-Token': 'apptoken',
      'X-Auth-Token': 'apptoken',
    },
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  const d = domain.create()

  d.run(function() {
    mikealRequest({
      method: 'POST',
      uri: 'http://example.com/resource',
      headers: {
        'X-App-Token': 'apptoken',
      },
    })
  })

  d.once('error', function(err) {
    t.ok(err.message.match(/No match/))
    t.end()
  })
})

test('matches request header with regular expression', t => {
  nock('http://example.com', {
    reqheaders: {
      'X-My-Super-Power': /.+/,
    },
  })
    .post('/superpowers')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.com/superpowers',
      headers: {
        'X-My-Super-Power': 'mullet growing',
      },
    },
    function(err, res, body) {
      t.strictEqual(err, null)
      t.equal(body, '{"status":"ok"}')
      t.end()
    }
  )
})

test('request header satisfies the header function', t => {
  nock('http://example.com', {
    reqheaders: {
      'X-My-Super-Power': function(value) {
        return value === 'mullet growing'
      },
    },
  })
    .post('/superpowers')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.com/superpowers',
      headers: {
        'X-My-Super-Power': 'mullet growing',
      },
    },
    function(err, res, body) {
      t.strictEqual(err, null)
      t.equal(body, '{"status":"ok"}')
      t.end()
    }
  )
})

test("done fails when specified request header doesn't match regular expression", t => {
  nock('http://example.com', {
    reqheaders: {
      'X-My-Super-Power': /Mullet.+/,
    },
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  const d = domain.create()

  d.run(function() {
    mikealRequest({
      method: 'POST',
      uri: 'http://example.com/superpowers',
      headers: {
        'X-My-Super-Power': 'mullet growing',
      },
    })
  })

  d.once('error', function(err) {
    t.ok(err.message.match(/No match/))
    t.end()
  })
})

test("done fails when specified request header doesn't satisfy the header function", t => {
  nock('http://example.com', {
    reqheaders: {
      'X-My-Super-Power': function(value) {
        return value === 'Mullet Growing'
      },
    },
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  const d = domain.create()

  d.run(function() {
    mikealRequest({
      method: 'POST',
      uri: 'http://example.com/superpowers',
      headers: {
        'X-My-Super-Power': 'mullet growing',
      },
    })
  })

  d.once('error', function(err) {
    t.ok(err.message.match(/No match/))
    t.end()
  })
})

test('done does not fail when specified request header is not missing', t => {
  nock('http://example.com', {
    reqheaders: {
      'X-App-Token': 'apptoken',
      'X-Auth-Token': 'apptoken',
    },
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.com/resource',
      headers: {
        'X-App-Token': 'apptoken',
        'X-Auth-Token': 'apptoken',
      },
    },
    function(err, res, body) {
      t.type(err, 'null')
      t.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('done fails when specified bad request header is present', t => {
  nock('http://example.com', {
    badheaders: ['cookie'],
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  const d = domain.create()

  d.run(function() {
    mikealRequest({
      method: 'POST',
      uri: 'http://example.com/resource',
      headers: {
        Cookie: 'cookie',
      },
    })
  })

  d.once('error', function(err) {
    t.ok(err.message.match(/No match/))
    t.end()
  })
})

test('mikeal/request with delayConnection and request.timeout', t => {
  nock('http://some-server.com')
    .post('/')
    .delayConnection(1000)
    .reply(200, {})

  mikealRequest.post(
    {
      url: 'http://some-server.com/',
      timeout: 10,
    },
    function(err) {
      t.type(err, 'Error')
      t.equal(err && err.code, 'ESOCKETTIMEDOUT')
      t.end()
    }
  )
})

test('get correct filtering with scope and request headers filtering', t => {
  const responseText = 'OK!'
  const responseHeaders = { 'Content-Type': 'text/plain' }
  const requestHeaders = { host: 'a.subdomain.of.google.com' }

  const scope = nock('http://a.subdomain.of.google.com', {
    filteringScope: function(scope) {
      return /^http:\/\/.*\.google\.com/.test(scope)
    },
  })
    .get('/somepath')
    .reply(200, responseText, responseHeaders)

  let dataCalled = false
  const host = 'some.other.subdomain.of.google.com'
  const req = http.get(
    {
      host,
      method: 'GET',
      path: '/somepath',
      port: 80,
    },
    function(res) {
      res.on('data', function(data) {
        dataCalled = true
        t.equal(data.toString(), responseText)
      })
      res.on('end', function() {
        t.true(dataCalled)
        scope.done()
        t.end()
      })
    }
  )

  t.equivalent(req._headers, { host: requestHeaders.host })
})

test('mocking succeeds even when mocked and specified request header names have different cases', t => {
  nock('http://example.com', {
    reqheaders: {
      'x-app-token': 'apptoken',
      'x-auth-token': 'apptoken',
    },
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.com/resource',
      headers: {
        'X-App-TOKEN': 'apptoken',
        'X-Auth-TOKEN': 'apptoken',
      },
    },
    function(err, res, body) {
      t.type(err, 'null')
      t.equal(res.statusCode, 200)
      t.end()
    }
  )
})

// https://github.com/nock/nock/issues/966
test('mocking succeeds when mocked and specified request headers have falsy values', t => {
  nock('http://example.com', {
    reqheaders: {
      'x-foo': 0,
    },
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.com/resource',
      headers: {
        'X-Foo': 0,
      },
    },
    function(err, res, body) {
      t.error(err)
      t.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('mocking succeeds even when host request header is not specified', t => {
  nock('http://example.com')
    .post('/resource')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.com/resource',
      headers: {
        'X-App-TOKEN': 'apptoken',
        'X-Auth-TOKEN': 'apptoken',
      },
    },
    function(err, res, body) {
      t.type(err, 'null')
      t.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('mikeal/request with strictSSL: true', t => {
  nock('https://strictssl.com')
    .post('/what')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'https://strictssl.com/what',
      strictSSL: true,
    },
    function(err, res, body) {
      t.type(err, 'null')
      t.equal(res && res.statusCode, 200)
      t.end()
    }
  )
})

test('response readable pull stream works as expected', t => {
  nock('http://streamingalltheway.com')
    .get('/ssstream')
    .reply(200, 'this is the response body yeah')

  const req = http.request(
    {
      host: 'streamingalltheway.com',
      path: '/ssstream',
      port: 80,
    },
    function(res) {
      let ended = false
      let responseBody = ''
      t.equal(res.statusCode, 200)
      res.on('readable', function() {
        let chunk
        while ((chunk = res.read()) !== null) {
          responseBody += chunk.toString()
        }
        if (chunk === null && !ended) {
          ended = true
          t.equal(responseBody, 'this is the response body yeah')
          t.end()
        }
      })
    }
  )

  req.end()
})

test('.setNoDelay', t => {
  nock('http://nodelayyy.com')
    .get('/yay')
    .reply(200, 'Hi')

  const req = http.request(
    {
      host: 'nodelayyy.com',
      path: '/yay',
      port: 80,
    },
    function(res) {
      t.equal(res.statusCode, 200)
      res.on('end', t.end.bind(t))
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.setNoDelay(true)

  req.end()
})

test('match basic authentication header', t => {
  const username = 'testuser'
  const password = 'testpassword'
  const authString = `${username}:${password}`

  const expectedAuthHeader = `Basic ${Buffer.from(authString).toString(
    'base64'
  )}`

  const scope = nock('http://www.headdy.com')
    .get('/')
    .matchHeader('Authorization', val => val === expectedAuthHeader)
    .reply(200, 'Hello World!')

  http.get(
    {
      host: 'www.headdy.com',
      path: '/',
      port: 80,
      auth: authString,
    },
    function(res) {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 200)

      res.on('data', function(data) {
        t.equal(data, 'Hello World!')
      })

      res.on('end', function() {
        scope.done()
        t.end()
      })
    }
  )
})

test('request emits socket', t => {
  nock('http://gotzsocketz.com')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://gotzsocketz.com')
  req.once('socket', function(socket) {
    t.equal(this, req)
    t.type(socket, Object)
    t.type(socket.getPeerCertificate(), 'string')
    t.end()
  })
})

test('socket emits connect and secureConnect', t => {
  t.plan(3)

  nock('http://gotzsocketz.com')
    .post('/')
    .reply(200, 'hey')

  const req = http.request({
    host: 'gotzsocketz.com',
    path: '/',
    method: 'POST',
  })

  req.on('socket', function(socket) {
    socket.once('connect', function() {
      req.end()
      t.ok(true)
    })
    socket.once('secureConnect', function() {
      t.ok(true)
    })
  })

  req.once('response', function(res) {
    res.setEncoding('utf8')
    res.on('data', function(d) {
      t.equal(d, 'hey')
    })
  })
})

test('socket setKeepAlive', t => {
  nock('http://setkeepalive.com')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://setkeepalive.com')
  req.once('socket', function(socket) {
    socket.setKeepAlive(true)
    t.end()
  })
})

test('abort destroys socket', t => {
  nock('http://socketdestroyer.com')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://socketdestroyer.com')
  req.once('error', function() {
    // ignore
  })
  req.once('socket', function(socket) {
    req.abort()
    t.ok(socket.destroyed)
    t.end()
  })
})

test('hyperquest works', t => {
  nock('http://hyperquest.com')
    .get('/somepath')
    .reply(200, 'Yay hyperquest!')

  const req = hyperquest('http://hyperquest.com/somepath')
  let reply = ''
  req.on('data', function(d) {
    reply += d
  })
  req.once('end', function() {
    t.equals(reply, 'Yay hyperquest!')
    t.end()
  })
})

test('match domain using regexp', t => {
  nock(/regexexample\.com/)
    .get('/resources')
    .reply(200, 'Match regex')

  mikealRequest.get('http://www.regexexample.com/resources', function(
    err,
    res,
    body
  ) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')

    t.end()
  })
})

test('match domain using regexp with path as callback (issue-1137)', t => {
  nock.cleanAll()
  nock(/.*/)
    .get(() => true)
    .reply(200, 'Match regex')

  mikealRequest.get('http://www.regexexample.com/resources', function(
    err,
    res,
    body
  ) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')
    t.end()
  })
})

test('match multiple interceptors with regexp domain (issue-508)', t => {
  nock.cleanAll()
  nock(/chainregex/)
    .get('/')
    .reply(200, 'Match regex')
    .get('/')
    .reply(500, 'Match second intercept')

  mikealRequest.get('http://www.chainregex.com', function(err, res, body) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')

    mikealRequest.get('http://www.chainregex.com', function(err, res, body) {
      t.type(err, 'null')
      t.equal(res.statusCode, 500)
      t.equal(body, 'Match second intercept')

      t.end()
    })
  })
})

test('match domain using intercept callback', t => {
  const validUrl = ['/cats', '/dogs']

  nock('http://www.interceptexample.com')
    .get(function(uri) {
      return validUrl.indexOf(uri) >= 0
    })
    .reply(200, 'Match intercept')
    .get('/cats')
    .reply(200, 'Match intercept 2')

  mikealRequest.get('http://www.interceptexample.com/cats', function(
    err,
    res,
    body
  ) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match intercept')

    // This one should match the second .get()
    mikealRequest.get('http://www.interceptexample.com/cats', function(
      err,
      res,
      body
    ) {
      t.type(err, 'null')
      t.equal(res.statusCode, 200)
      t.equal(body, 'Match intercept 2')
      t.end()
    })
  })
})

test('match path using regexp', t => {
  nock('http://www.pathregex.com')
    .get(/regex$/)
    .reply(200, 'Match regex')

  mikealRequest.get('http://www.pathregex.com/resources/regex', function(
    err,
    res,
    body
  ) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')
    t.end()
  })
})

test('match path using regexp with allowUnmocked', t => {
  nock('http://www.pathregex.com', { allowUnmocked: true })
    .get(/regex$/)
    .reply(200, 'Match regex')

  mikealRequest.get('http://www.pathregex.com/resources/regex', function(
    err,
    res,
    body
  ) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')
    t.end()
  })
})

test('match hostname using regexp with allowUnmocked (issue-1076)', t => {
  nock(/localhost/, { allowUnmocked: true })
    .get('/no/regex/here')
    .reply(200, 'Match regex')

  mikealRequest.get('http://localhost:3000/no/regex/here', function(
    err,
    res,
    body
  ) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')
    t.end()
  })
})

test('match path using function', t => {
  const path = '/match/uri/function'
  const options = {
    hostname: 'pathfunction.com',
    path,
  }
  const uriFunction = function(uri) {
    return uri === path
  }

  nock(`http://${options.hostname}`)
    .delete(uriFunction)
    .reply(200, 'Match DELETE')
    .get(uriFunction)
    .reply(200, 'Match GET')
    .head(uriFunction)
    .reply(200, 'Match HEAD')
    .merge(uriFunction)
    .reply(200, 'Match MERGE')
    .options(uriFunction)
    .reply(200, 'Match OPTIONS')
    .patch(uriFunction)
    .reply(200, 'Match PATCH')
    .post(uriFunction)
    .reply(200, 'Match POST')
    .put(uriFunction)
    .reply(200, 'Match PUT')

  options.method = 'POST'
  http
    .request(options, function(res) {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 200)
      let body = ''
      res.on('data', function(data) {
        body += data
      })
      res.on('end', function() {
        t.equal(body, `Match ${options.method}`)

        options.method = 'GET'
        http
          .request(options, function(res) {
            res.setEncoding('utf8')
            t.equal(res.statusCode, 200)
            let body = ''
            res.on('data', function(data) {
              body += data
            })
            res.on('end', function() {
              t.equal(body, `Match ${options.method}`)

              options.method = 'OPTIONS'
              options.path = '/no/match'
              http
                .request(options)
                .on('error', e => {
                  t.similar(e.toString(), /Error: Nock: No match for request/)
                  t.end()
                })
                .end()
            })
          })
          .end()
      })
    })
    .end()
})

test('remove interceptor for GET resource', t => {
  const scope = nock('http://example.org')
    .get('/somepath')
    .reply(200, 'hey')

  const mocks = scope.pendingMocks()
  t.deepEqual(mocks, ['GET http://example.org:80/somepath'])

  const result = nock.removeInterceptor({
    hostname: 'example.org',
    path: '/somepath',
  })
  t.ok(result, 'result should be true')

  nock('http://example.org')
    .get('/somepath')
    .reply(202, 'other-content')

  http.get(
    {
      host: 'example.org',
      path: '/somepath',
    },
    function(res) {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 202)

      res.on('data', function(data) {
        t.equal(data, 'other-content')
      })

      res.on('end', function() {
        t.end()
      })
    }
  )
})

test('remove interceptor removes given interceptor', t => {
  const givenInterceptor = nock('http://example.org').get('/somepath')
  const scope = givenInterceptor.reply(200, 'hey')

  const mocks = scope.pendingMocks()
  t.deepEqual(mocks, ['GET http://example.org:80/somepath'])

  const result = nock.removeInterceptor(givenInterceptor)
  t.ok(result, 'result should be true')

  nock('http://example.org')
    .get('/somepath')
    .reply(202, 'other-content')

  http.get(
    {
      host: 'example.org',
      path: '/somepath',
    },
    function(res) {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 202)

      res.on('data', function(data) {
        t.equal(data, 'other-content')
      })

      res.on('end', function() {
        t.end()
      })
    }
  )
})

test('remove interceptor removes interceptor from pending requests', t => {
  const givenInterceptor = nock('http://example.org').get('/somepath')
  const scope = givenInterceptor.reply(200, 'hey')

  const mocks = scope.pendingMocks()
  t.deepEqual(mocks, ['GET http://example.org:80/somepath'])

  const result = nock.removeInterceptor(givenInterceptor)
  t.ok(result, 'result should be true')

  const mocksAfterRemove = scope.pendingMocks()
  t.deepEqual(mocksAfterRemove, [])
  t.end()
})

test('remove interceptor removes given interceptor for https', t => {
  const givenInterceptor = nock('https://example.org').get('/somepath')
  const scope = givenInterceptor.reply(200, 'hey')

  const mocks = scope.pendingMocks()
  t.deepEqual(mocks, ['GET https://example.org:443/somepath'])

  const result = nock.removeInterceptor(givenInterceptor)
  t.ok(result, 'result should be true')

  nock('https://example.org')
    .get('/somepath')
    .reply(202, 'other-content')

  https.get(
    {
      host: 'example.org',
      path: '/somepath',
    },
    function(res) {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 202)

      res.on('data', function(data) {
        t.equal(data, 'other-content')
      })

      res.on('end', function() {
        t.end()
      })
    }
  )
})

test('remove interceptor removes given interceptor for regex path', t => {
  const givenInterceptor = nock('http://example.org').get(/somePath$/)
  const scope = givenInterceptor.reply(200, 'hey')

  const mocks = scope.pendingMocks()
  t.deepEqual(mocks, ['GET http://example.org:80//somePath$/'])

  const result = nock.removeInterceptor(givenInterceptor)
  t.ok(result, 'result should be true')

  nock('http://example.org')
    .get(/somePath$/)
    .reply(202, 'other-content')

  http.get(
    {
      host: 'example.org',
      path: '/get-somePath',
    },
    function(res) {
      res.setEncoding('utf8')
      t.equal(res.statusCode, 202)

      res.once('data', function(data) {
        t.equal(data, 'other-content')
      })

      res.on('end', function() {
        t.end()
      })
    }
  )
})

test('remove interceptor for not found resource', t => {
  const result = nock.removeInterceptor({
    hostname: 'example.org',
    path: '/somepath',
  })
  t.notOk(result, 'result should be false as no interceptor was found')
  t.end()
})

test('isDone() must consider repeated responses', t => {
  const scope = nock('http://www.example.com')
    .get('/')
    .times(2)
    .reply(204)

  function makeRequest(callback) {
    const req = http.request(
      {
        host: 'www.example.com',
        path: '/',
        port: 80,
      },
      function(res) {
        t.equal(res.statusCode, 204)
        res.on('end', callback)
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )
    req.end()
  }

  t.notOk(scope.isDone(), 'should not be done before all requests')
  makeRequest(function() {
    t.notOk(scope.isDone(), 'should not yet be done after the first request')
    makeRequest(function() {
      t.ok(scope.isDone(), 'should be done after the two requests are made')
      scope.done()
      t.end()
    })
  })
})

test('you must setup an interceptor for each request', t => {
  const scope = nock('http://www.example.com')
    .get('/hey')
    .reply(200, 'First match')

  mikealRequest.get('http://www.example.com/hey', function(error, res, body) {
    t.equal(res.statusCode, 200)
    t.equal(body, 'First match', 'should match first request response body')

    mikealRequest.get('http://www.example.com/hey', function(error, res, body) {
      t.equal(
        error && error.toString(),
        `Error: Nock: No match for request ${JSON.stringify(
          {
            method: 'GET',
            url: 'http://www.example.com/hey',
            headers: { host: 'www.example.com' },
          },
          null,
          2
        )}`
      )
      scope.done()
      t.end()
    })
  })
})

test('calling socketDelay will emit a timeout', t => {
  nock('http://www.example.com')
    .get('/')
    .socketDelay(10000)
    .reply(200, 'OK')

  let timedout = false
  let ended = false

  const req = http.request('http://www.example.com', function(res) {
    res.setEncoding('utf8')

    res.once('end', function() {
      ended = true
      if (!timedout) {
        t.fail('socket did not timeout when idle')
        t.end()
      }
    })
  })

  req.setTimeout(5000, function() {
    timedout = true
    if (!ended) {
      t.ok(true)
      t.end()
    }
  })

  req.end()
})

test('calling socketDelay not emit a timeout if not idle for long enough', t => {
  nock('http://www.example.com')
    .get('/')
    .socketDelay(10000)
    .reply(200, 'OK')

  const req = http.request('http://www.example.com', function(res) {
    res.setEncoding('utf8')

    let body = ''

    res.on('data', function(chunk) {
      body += chunk
    })

    res.once('end', function() {
      t.equal(body, 'OK')
      t.end()
    })
  })

  req.setTimeout(60000, function() {
    t.fail('socket timed out unexpectedly')
    t.end()
  })

  req.end()
})

test('replyWithError returns an error on request', t => {
  const scope = nock('http://www.google.com')
    .post('/echo')
    .replyWithError('Service not found')

  const req = http.request({
    host: 'www.google.com',
    method: 'POST',
    path: '/echo',
    port: 80,
  })

  // An error should have have been raised
  req.on('error', function(e) {
    scope.done()
    t.equal(e.message, 'Service not found')
    t.end()
  })

  req.end()
})

test('replyWithError allows json response', t => {
  const scope = nock('http://www.google.com')
    .post('/echo')
    .replyWithError({ message: 'Service not found', code: 'test' })

  const req = http.request({
    host: 'www.google.com',
    method: 'POST',
    path: '/echo',
    port: 80,
  })

  // An error should have have been raised
  req.on('error', function(e) {
    scope.done()
    t.equal(e.message, 'Service not found')
    t.equal(e.code, 'test')
    t.end()
  })

  req.end()
})

test('no content type provided', t => {
  const scope = nock('http://nocontenttype.com')
    .replyContentLength()
    .post('/httppost', function() {
      return true
    })
    .reply(401, '')

  http
    .request(
      {
        host: 'nocontenttype.com',
        path: '/httppost',
        method: 'POST',
        headers: {},
      },
      function(res) {
        res.on('data', function() {})
        res.once('end', function() {
          scope.done()
          t.ok(true)
          t.end()
        })
      }
    )
    .end('WHAA')
})

test('query() matches a query string of the same name=value', t => {
  nock('http://google.com')
    .get('/')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('http://google.com/?foo=bar', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() matches multiple query strings of the same name=value', t => {
  nock('http://google.com')
    .get('/')
    .query({ foo: 'bar', baz: 'foz' })
    .reply(200)

  mikealRequest('http://google.com/?foo=bar&baz=foz', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() matches multiple query strings of the same name=value regardless of order', t => {
  nock('http://google.com')
    .get('/')
    .query({ foo: 'bar', baz: 'foz' })
    .reply(200)

  mikealRequest('http://google.com/?baz=foz&foo=bar', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() matches query values regardless of their type of declaration', t => {
  nock('http://google.com')
    .get('/')
    .query({ num: 1, bool: true, empty: null, str: 'fou' })
    .reply(200)

  mikealRequest('http://google.com/?num=1&bool=true&empty=&str=fou', function(
    err,
    res
  ) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test("query() doesn't match query values of requests without query string", t => {
  nock('http://google.com')
    .get('/')
    .query({ num: 1, bool: true, empty: null, str: 'fou' })
    .reply(200, 'scope1')

  nock('http://google.com')
    .get('/')
    .reply(200, 'scope2')

  mikealRequest('http://google.com/', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.equal(res.body, 'scope2')
    t.end()
  })
})

test('query() matches a query string using regexp', t => {
  nock('http://google.com')
    .get('/')
    .query({ foo: /.*/ })
    .reply(200)

  mikealRequest('http://google.com/?foo=bar', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() matches a query string that contains special RFC3986 characters', t => {
  nock('http://google.com')
    .get('/')
    .query({ 'foo&bar': 'hello&world' })
    .reply(200)

  const options = {
    uri: 'http://google.com/',
    qs: {
      'foo&bar': 'hello&world',
    },
  }

  mikealRequest(options, function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() expects unencoded query params', t => {
  nock('http://google.com')
    .get('/')
    .query({ foo: 'hello%20world' })
    .reply(200)

  mikealRequest('http://google.com?foo=hello%20world', function(err, res) {
    t.similar(err.toString(), /Error: Nock: No match for request/)
    t.end()
  })
})

test('query() matches a query string with pre-encoded values', t => {
  nock('http://google.com', { encodedQueryParams: true })
    .get('/')
    .query({ foo: 'hello%20world' })
    .reply(200)

  mikealRequest('http://google.com?foo=hello%20world', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with "true" will allow all query strings to pass', t => {
  nock('http://google.com')
    .get('/')
    .query(true)
    .reply(200)

  mikealRequest('http://google.com/?foo=bar&a=1&b=2', function(err, res) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with "{}" will allow a match against ending in ?', t => {
  nock('http://querystringmatchland.com')
    .get('/noquerystring')
    .query({})
    .reply(200)

  mikealRequest('http://querystringmatchland.com/noquerystring?', function(
    err,
    res
  ) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with a function, function called with actual queryObject', t => {
  let queryObject

  const queryValidator = function(qs) {
    queryObject = qs
    return true
  }

  nock('http://google.com')
    .get('/')
    .query(queryValidator)
    .reply(200)

  mikealRequest('http://google.com/?foo=bar&a=1&b=2', function(err, res) {
    if (err) throw err
    t.deepEqual(queryObject, { foo: 'bar', a: '1', b: '2' })
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with a function, function return true the query treat as matched', t => {
  const alwasyTrue = function() {
    return true
  }

  nock('http://google.com')
    .get('/')
    .query(alwasyTrue)
    .reply(200)

  mikealRequest('http://google.com/?igore=the&actual=query', function(
    err,
    res
  ) {
    if (err) throw err
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('query() with a function, function return false the query treat as Un-matched', t => {
  const alwayFalse = function() {
    return false
  }

  nock('http://google.com')
    .get('/')
    .query(alwayFalse)
    .reply(200)

  mikealRequest('http://google.com/?i=should&pass=?', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'http://google.com/?i=should&pass=?',
          headers: { host: 'google.com' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string does not match name=value', t => {
  nock('https://c.com')
    .get('/b')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('https://c.com/b?foo=baz', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'https://c.com/b?foo=baz',
          headers: { host: 'c.com' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string is present that was not registered', t => {
  nock('https://b.com')
    .get('/c')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('https://b.com/c?foo=bar&baz=foz', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'https://b.com/c?foo=bar&baz=foz',
          headers: { host: 'b.com' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string is malformed', t => {
  nock('https://a.com')
    .get('/d')
    .query({ foo: 'bar' })
    .reply(200)

  mikealRequest('https://a.com/d?foobar', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'https://a.com/d?foobar',
          headers: { host: 'a.com' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query() will not match when a query string has fewer correct values than expected', t => {
  nock('http://google.com')
    .get('/')
    .query({
      num: 1,
      bool: true,
      empty: null,
      str: 'fou',
    })
    .reply(200)

  mikealRequest('http://google.com/?num=1str=fou', function(err, res) {
    t.equal(
      err.message.trim(),
      `Nock: No match for request ${JSON.stringify(
        {
          method: 'GET',
          url: 'http://google.com/?num=1str=fou',
          headers: { host: 'google.com' },
        },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('query(true) will match when the path has no query', t => {
  nock('http://google.com')
    .get('/')
    .query(true)
    .reply(200)

  mikealRequest('http://google.com', function(err, res) {
    t.ok(!err, 'no error')
    t.ok(res)
    t.equal(res.statusCode, 200)
    t.end()
  })
})

// https://github.com/nock/nock/issues/835
test('match domain and path using regexp', t => {
  nock.cleanAll()
  const imgResponse = 'Matched Images Page'

  const scope = nock(/google/)
    .get(/img/)
    .reply(200, imgResponse)

  mikealRequest.get('http://www.google.com/imghp?hl=en', function(
    err,
    res,
    body
  ) {
    scope.done()
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, imgResponse)
    t.end()
  })
})

// https://github.com/nock/nock/issues/835
test('match multiple paths to domain using regexp with allowUnmocked', t => {
  nock.cleanAll()

  const nockOpts = { allowUnmocked: true }
  const searchResponse = 'Matched Google Search Results Page'
  const imgResponse = 'Matched Google Images Page'

  const scope1 = nock(/google/, nockOpts)
    .get(/imghp/)
    .reply(200, imgResponse)

  const scope2 = nock(/google/, nockOpts)
    .get(/search/)
    .reply(200, searchResponse)

  mikealRequest.get('http://www.google.com', function(err, res, body) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)

    mikealRequest.get('http://www.google.com/imghp?hl=en', function(
      err,
      res,
      body
    ) {
      scope1.done()
      t.type(err, 'null')
      t.equal(res.statusCode, 200)
      t.equal(body, imgResponse)

      mikealRequest.get('http://www.google.com/search?q=pugs', function(
        err,
        res,
        body
      ) {
        scope2.done()
        t.type(err, 'null')
        t.equal(res.statusCode, 200)
        t.equal(body, searchResponse)
        t.end()
      })
    })
  })
})

test('match domain and path using regexp with query params and allow unmocked', t => {
  nock.cleanAll()
  const imgResponse = 'Matched Images Page'
  const opts = { allowUnmocked: true }

  const scope = nock(/google/, opts)
    .get(/imghp\?hl=en/)
    .reply(200, imgResponse)

  mikealRequest.get('http://www.google.com/imghp?hl=en', function(
    err,
    res,
    body
  ) {
    scope.done()
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, imgResponse)
    t.end()
  })
})

test('multiple interceptors override headers from unrelated request', t => {
  nock.cleanAll()

  nock.define([
    {
      scope: 'https://api.github.com:443',
      method: 'get',
      path: '/bar',
      reqheaders: {
        'x-foo': 'bar',
      },
      status: 200,
      response: {},
    },
    {
      scope: 'https://api.github.com:443',
      method: 'get',
      path: '/baz',
      reqheaders: {
        'x-foo': 'baz',
      },
      status: 200,
      response: {},
    },
  ])

  mikealRequest(
    {
      url: 'https://api.github.com/bar',
      headers: {
        'x-foo': 'bar',
      },
    },
    function(err, res, body) {
      t.error(err)
      t.equal(res.statusCode, 200)

      mikealRequest.get(
        {
          url: 'https://api.github.com/baz',
          headers: {
            'x-foo': 'baz',
          },
        },
        function(err, res, body) {
          t.error(err)
          t.equal(res.statusCode, 200)
          t.end()
        }
      )
    }
  )
})

// https://github.com/nock/nock/issues/490
test('match when query is specified with allowUnmocked', t => {
  nock.cleanAll()

  const nockOpts = { allowUnmocked: true }
  const searchResponse = 'Matched body'

  const scope = nock('http://www.google.com/', nockOpts)
    .get('/search')
    .query({ q: 'js' })
    .reply(200, searchResponse)

  mikealRequest.get('http://www.google.com', function(err, res, body) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)

    mikealRequest.get('http://www.google.com/search?q=js', function(
      err,
      res,
      body
    ) {
      scope.done()
      t.type(err, 'null')
      t.equal(res.statusCode, 200)
      t.equal(body, searchResponse)
      t.end()
    })
  })
})

// https://github.com/nock/nock/issues/1003
test('correctly parse request without specified path', t => {
  nock.cleanAll()

  const scope1 = nock('https://example.com')
    .get('')
    .reply(200)

  https
    .request({ hostname: 'example.com' }, function(res) {
      t.equal(res.statusCode, 200)
      res.on('data', function() {})
      res.on('end', function() {
        scope1.done()
        t.end()
      })
    })
    .end()
})

test('data is sent with flushHeaders', t => {
  nock.cleanAll()

  const scope1 = nock('https://example.com')
    .get('')
    .reply(200, 'this is data')

  https
    .request({ hostname: 'example.com' }, function(res) {
      t.equal(res.statusCode, 200)
      res.on('data', function(data) {
        t.equal(data.toString(), 'this is data')
      })
      res.on('end', function() {
        scope1.done()
        t.end()
      })
    })
    .flushHeaders()
})

test('stop persisting a persistent nock', t => {
  nock.cleanAll()
  const scope = nock('http://persist.com')
    .persist(true)
    .get('/')
    .reply(200, 'Persisting all the way')

  t.ok(!scope.isDone())
  http
    .get('http://persist.com/', function() {
      t.ok(scope.isDone())
      t.deepEqual(nock.activeMocks(), ['GET http://persist.com:80/'])
      scope.persist(false)
      http
        .get('http://persist.com/', function() {
          t.equal(nock.activeMocks().length, 0)
          t.ok(scope.isDone())
          http
            .get('http://persist.com/')
            .on('error', e => {
              t.similar(e.toString(), /Error: Nock: No match for request/)
              t.end()
            })
            .end()
        })
        .end()
    })
    .end()
})

test("should throw an error when persist flag isn't a boolean", t => {
  try {
    nock('http://persist.com').persist('string')
  } catch (e) {
    t.similar(e.toString(), /Invalid arguments: argument should be a boolean/)
    t.end()
  }
})

test('teardown', t => {
  let leaks = Object.keys(global).splice(globalCount, Number.MAX_VALUE)

  leaks = leaks.filter(function(key) {
    return acceptableLeaks.indexOf(key) == -1
  })

  t.deepEqual(leaks, [], 'No leaks')
  t.end()
})
