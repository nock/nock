'use strict'

const http = require('http')
const path = require("path")
const { test } = require('tap')
const mikealRequest = require('request')
const got = require('got')
const lolex = require('lolex')
const proxyquire = require('proxyquire').noPreserveCache()
const nock = require('..')

const textFile = path.join(__dirname, '..', 'assets', 'reply_file_1.txt')
const binaryFile = path.join(__dirname, '..', 'assets', 'reply_file_2.txt.gz')

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
  const scope = nock('http://example.test', {
    filteringScope: scope => /^http:\/\/.*\.example/.test(scope),
  })
    .get('/')
    .reply(200, () => 'OK!')

  const { body } = await got('http://a.example.test')
  t.equal(body, 'OK!')
  scope.done()
})

test('get with reply callback returning object', async t => {
  const exampleResponse = { message: 'OK!' }

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, () => exampleResponse)

  const { body } = await got('http://example.test')
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

test('reply with file', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(200, textFile)

  const { statusCode, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.equal(body, 'Hello from the file!')

  scope.done()
})

test('reply with file with headers', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(200, binaryFile, {
      'content-encoding': 'gzip',
    })

  const { statusCode, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.equal(body.length, 20)
  scope.done()
})

test('reply with file with no fs', t => {
  const nockWithoutFs = proxyquire('../lib/scope', {
    './interceptor': proxyquire('../lib/interceptor', { fs: null }),
  })

  t.throws(
    () =>
      nockWithoutFs('http://example.test')
        .get('/')
        .replyWithFile(200, textFile),
    {
      message: 'No fs',
    }
  )

  t.end()
})

test('reply with JSON', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, { hello: 'world' })

  const { statusCode, headers, body } = await got('http://example.test/')

  t.equal(statusCode, 200)
  t.type(headers.date, 'undefined')
  t.type(headers['content-length'], 'undefined')
  t.equal(headers['content-type'], 'application/json')
  t.equal(body, '{"hello":"world"}', 'response should match')
  scope.done()
})

test('reply with content-length header', async t => {
  const scope = nock('http://example.test')
    .replyContentLength()
    .get('/')
    .reply(200, { hello: 'world' })

  const { headers } = await got('http://example.test/')

  t.equal(headers['content-length'], 17)
  scope.done()
})

test('reply with explicit date header', async t => {
  const date = new Date()

  const scope = nock('http://example.test')
    .replyDate(date)
    .get('/')
    .reply(200, { hello: 'world' })

  const { headers } = await got('http://example.test/')

  t.equal(headers.date, date.toUTCString())
  scope.done()
})

// async / got version is returning "not ok test unfinished".
// https://github.com/nock/nock/issues/1305#issuecomment-451701657
test('reply with implicit date header', t => {
  const clock = lolex.install()
  const date = new Date()

  const scope = nock('http://example.test')
    .replyDate()
    .get('/')
    .reply(200)

  mikealRequest.get('http://example.test', (err, resp) => {
    clock.uninstall()

    if (err) {
      throw err
    }

    t.equal(resp.headers.date, date.toUTCString())
    scope.done()

    t.end()
  })
})

test('JSON encoded replies set the content-type header', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, {
      A: 'b',
    })

  t.equal(
    (await got('http://example.test/')).headers['content-type'],
    'application/json'
  )

  scope.done()
})

test('JSON encoded replies does not overwrite existing content-type header', async t => {
  const scope = nock('http://example.test')
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

  t.equal(
    (await got('http://example.test/')).headers['content-type'],
    'unicorns'
  )

  scope.done()
})

test("blank response doesn't have content-type application/json attached to it", async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200)

  t.equal(
    (await got('http://example.test/')).headers['content-type'],
    undefined
  )

  scope.done()
})

test('unencodable object throws the expected error', t => {
  const unencodableObject = {
    toJSON() {
      throw Error('bad!')
    },
  }

  t.throws(
    () =>
      nock('http://localhost')
        .get('/')
        .reply(200, unencodableObject),
    {
      message: 'Error encoding response body into JSON',
    }
  )

  t.end()
})

test('replyWithError returns an error on request', t => {
  const scope = nock('http://example.test')
    .post('/echo')
    .replyWithError('Service not found')

  const req = http.request({
    host: 'example.test',
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
  const scope = nock('http://example.test')
    .post('/echo')
    .replyWithError({ message: 'Service not found', code: 'test' })

  const req = http.request({
    host: 'example.test',
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
