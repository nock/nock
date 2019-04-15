'use strict'

const url = require('url')
const http = require('http')
const https = require('https')
const { test } = require('tap')
const mikealRequest = require('request')
const superagent = require('superagent')
const needle = require('needle')
const restify = require('restify-clients')
const assertRejects = require('assert-rejects')
const hyperquest = require('hyperquest')
const got = require('got')
const nock = require('..')

require('./cleanup_after_each')()

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

test("when the path doesn't include a leading slash it raises an error", function(t) {
  t.plan(1)
  t.throws(() => nock('http://example.test').get('no-leading-slash'))
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

test('filteringPath with invalid argument throws expected', t => {
  t.throws(() => nock('http://example.test').filteringPath('abc123'), {
    message:
      'Invalid arguments: filtering path should be a function or a regular expression',
  })
  t.end()
})

test('filteringRequestBody with invalid argument throws expected', t => {
  t.throws(() => nock('http://example.test').filteringRequestBody('abc123'), {
    message:
      'Invalid arguments: filtering request body should be a function or a regular expression',
  })
  t.end()
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
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  const { body } = await got('http://example.test/', { encoding: 'base64' })

  t.type(body, 'string')
  t.equal(body, 'SGVsbG8gV29ybGQh', 'response should match base64 encoding')

  scope.done()
})

test('filter path with function', async t => {
  const scope = nock('http://example.test')
    .filteringPath(path => '/?a=2&b=1')
    .get('/?a=2&b=1')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    query: { a: '1', b: '2' },
  })

  t.equal(statusCode, 200)
  scope.done()
})

test('filter path with regexp', async t => {
  const scope = nock('http://example.test')
    .filteringPath(/\d/g, '3')
    .get('/?a=3&b=3')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    query: { a: '1', b: '2' },
  })

  t.equal(statusCode, 200)
  scope.done()
})

test('filter body with function', async t => {
  let filteringRequestBodyCounter = 0

  const scope = nock('http://example.test')
    .filteringRequestBody(body => {
      ++filteringRequestBodyCounter
      t.equal(body, 'mamma mia')
      return 'mamma tua'
    })
    .post('/', 'mamma tua')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    body: 'mamma mia',
  })

  t.equal(statusCode, 200)
  scope.done()
  t.equal(filteringRequestBodyCounter, 1)
})

test('filter body with regexp', async t => {
  const scope = nock('http://example.test')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/', {
    body: 'mamma mia',
  })

  t.equal(statusCode, 200)
  scope.done()
})

// TODO Convert to async / got.
test('abort request', t => {
  const scope = nock('http://example.test')
    .get('/hey')
    .reply(200, 'nobody')

  const req = http.request({
    host: 'example.test',
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

// TODO Convert to async / got.
test('pause response before data', t => {
  const scope = nock('http://example.test')
    .get('/pauser')
    .reply(200, 'nobody')

  const req = http.request({
    host: 'example.test',
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

test('chaining API', async t => {
  const scope = nock('http://example.test')
    .get('/one')
    .reply(200, 'first one')
    .get('/two')
    .reply(200, 'second one')

  const response1 = await got('http://example.test/one')

  t.equal(response1.statusCode, 200)
  t.equal(response1.body, 'first one')

  const response2 = await got('http://example.test/two')

  t.equal(response2.statusCode, 200)
  t.equal(response2.body, 'second one')

  scope.done()
})

test('same URI', async t => {
  const scope = nock('http://example.test')
    .get('/abc')
    .reply(200, 'first one')
    .get('/abc')
    .reply(201, 'second one')

  const response1 = await got('http://example.test/abc')

  t.equal(response1.statusCode, 200)
  t.equal(response1.body, 'first one')

  const response2 = await got('http://example.test/abc')

  t.equal(response2.statusCode, 201)
  t.equal(response2.body, 'second one')

  scope.done()
})

// TODO Should this test be kept?
test('can use hostname instead of host', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  const req = http.request(
    {
      hostname: 'example.test',
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

// TODO convert to async / got.
test('hostname is case insensitive', t => {
  const scope = nock('http://example.test')
    .get('/path')
    .reply(200, 'hey')

  const options = {
    hostname: 'example.test',
    path: '/path',
    method: 'GET',
  }

  const req = http.request(options, function(res) {
    scope.done()
    t.end()
  })

  req.end()
})

test('can take a port', async t => {
  const scope = nock('http://example.test:3333')
    .get('/')
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test:3333/')

  t.equal(statusCode, 200)
  scope.done()
})

test('can use https', async t => {
  const scope = nock('https://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('https://example.test/', {
    encoding: null,
  })

  t.equal(statusCode, 200)
  t.type(body, Buffer)
  t.equal(body.toString(), 'Hello World!')
  scope.done()
})

// TODO convert to got / async.
test('emits error if https route is missing', t => {
  nock('https://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  const req = https.request(
    {
      host: 'example.test',
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
        { method: 'GET', url: 'https://example.test/abcdef892932' },
        null,
        2
      )}`
    )
    t.end()
  })
})

// TODO convert to got / async.
test('emits error if https route is missing', t => {
  nock('https://example.test:123')
    .get('/')
    .reply(200, 'Hello World!')

  const req = https.request(
    {
      host: 'example.test',
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
        { method: 'GET', url: 'https://example.test:123/dsadsads' },
        null,
        2
      )}`
    )
    t.end()
  })
})

test('scopes are independent', async t => {
  const scope1 = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')
  const scope2 = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  await got('http://example.test/')

  t.true(scope1.isDone())
  t.false(scope2.isDone())
})

test('two scopes with the same request are consumed', async t => {
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
      function(res) {
        scope.done()
        t.end()
      }
    )
    .end()
})

test('works with mikeal/request and username and password', t => {
  const scope = nock('http://example.test')
    .get('/abc')
    .reply(200, 'Welcome, username')

  mikealRequest(
    { uri: 'http://username:password@example.test/abc', log: true },
    function(err, res, body) {
      t.ok(!err, 'error')
      t.ok(scope.isDone())
      t.equal(body, 'Welcome, username')
      t.end()
    }
  )
})

test('different ports work works', t => {
  const scope = nock('http://example.test:8081')
    .get('/pathhh')
    .reply(200, 'Welcome, username')

  http
    .request(
      {
        hostname: 'example.test',
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
  const scope = nock('http://example.test:8082')
    .get('/pathhh')
    .reply(200, 'Welcome to Mikeal Request!')

  mikealRequest.get('http://example.test:8082/pathhh', function(
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
  const scope = nock('http://example.test:80')
    .get('/pathhh')
    .reply(200, 'Welcome, username')

  http
    .request(
      {
        hostname: 'example.test',
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
  const scope = nock('http://example.test')
    .post('/claim', { some_data: 'something' })
    .reply(200)

  http
    .request(
      {
        hostname: 'example.test',
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
  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  http.get('http://example.test', function(res) {
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
    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    http.get(new url.URL('http://example.test'), function(res) {
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
  const scope = nock('http://example.test')
    .get('/the/path/to/infinity')
    .reply(200)

  const req = http.request(
    {
      hostname: 'example.test',
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

test('allow unordered body with json encoding', t => {
  const scope = nock('http://example.test')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo',
    })
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://example.test/like-wtf',
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
  const scope = nock('http://example.test')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo',
    })
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://example.test/like-wtf',
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

  const scope = nock('http://example.test')
    .post('/like-wtf', JSON.stringify(bodyObject))
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://example.test/like-wtf',
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
  const scope = nock('http://example.test')
    .get('/like-wtf')
    .reply(200)
  const req = http.request('http://example.test/like-wtf', function(res) {
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

test('superagent works', t => {
  const responseText = 'Yay superagent!'
  const headers = { 'Content-Type': 'text/plain' }
  nock('http://example.test')
    .get('/somepath')
    .reply(200, responseText, headers)

  superagent.get('http://example.test/somepath').end(function(err, res) {
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

  superagent.get('http://example.test/somepath?a=b').end(function(err, res) {
    t.equal(res.text, responseText)
    t.end()
  })
})

test('superagent posts', t => {
  nock('http://example.test')
    .post('/somepath?b=c')
    .reply(204)

  superagent
    .post('http://example.test/somepath?b=c')
    .send('some data')
    .end(function(err, res) {
      t.equal(res.status, 204)
      t.end()
    })
})

test('response is an http.IncomingMessage instance', t => {
  const responseText = 'incoming message!'
  nock('http://example.test')
    .get('/somepath')
    .reply(200, responseText)

  http
    .request(
      {
        host: 'example.test',
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

test('write callback called', t => {
  const scope = nock('http://filterboddiezregexp.com')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  let callbackCalled = false
  const req = http.request(
    {
      host: 'filterboddiezregexp.com',
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
  const scope = nock('http://example.test')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  let callbackCalled = false
  const req = http.request(
    {
      host: 'example.test',
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
  const scope = nock('http://example.test')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply(200, 'Hello World!')

  let finishCalled = false
  const req = http.request(
    {
      host: 'example.test',
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

test('sending binary and receiving JSON should work ', t => {
  const scope = nock('http://example.test')
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
      uri: 'http://example.test/some/path',
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

  nock('http://example.test')
    .get('/abc')
    .reply(200, replyBuffer)

  needle.get('http://example.test/abc', function(err, res, buffer) {
    t.notOk(err)
    t.ok(res)
    t.ok(buffer)
    t.same(buffer, replyBuffer)
    t.end()
  })
})

test('handles get with restify client', t => {
  const scope = nock('https://example.test')
    .get('/get')
    .reply(200, 'get')

  const client = restify.createClient({
    url: 'https://example.test',
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
  const scope = nock('https://example.test')
    .post('/post', 'hello world')
    .reply(200, 'post')

  const client = restify.createClient({
    url: 'https://example.test',
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
  const scope = nock('https://example.test')
    .get('/get')
    .reply(200, { get: 'ok' })

  const client = restify.createJsonClient({
    url: 'https://example.test',
  })

  client.get('/get', function(err, req, res, obj) {
    t.equal(obj.get, 'ok')
    t.end()
    scope.done()
  })
})

test('handles post with restify JsonClient', t => {
  const scope = nock('https://example.test')
    .post('/post', { username: 'banana' })
    .reply(200, { post: 'ok' })

  const client = restify.createJsonClient({
    url: 'https://example.test',
  })

  client.post('/post', { username: 'banana' }, function(err, req, res, obj) {
    t.equal(obj.post, 'ok')
    t.end()
    scope.done()
  })
})

test('handles 404 with restify JsonClient', t => {
  const scope = nock('https://example.test')
    .put('/404')
    .reply(404)

  const client = restify.createJsonClient({
    url: 'https://example.test',
  })

  client.put('/404', function(err, req, res, obj) {
    t.equal(res.statusCode, 404)
    t.end()
    scope.done()
  })
})

test('handles 500 with restify JsonClient', t => {
  const scope = nock('https://example.test')
    .delete('/500')
    .reply(500)

  const client = restify.createJsonClient({
    url: 'https://example.test',
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

test('do not match when conditionally = false but should match after trying again when = true', async t => {
  t.plan(2)
  let enabled = false

  const scope = nock('http://example.test', {
    conditionally: function() {
      return enabled
    },
  })
    .get('/')
    .reply(200)

  // now the scope has been used, should fail on second try
  await assertRejects(
    got('http://example.test/'),
    Error,
    'Nock: No match for request'
  )
  t.throws(() => scope.done(), {
    message: 'Mocks not yet satisfied',
  })

  enabled = true

  const { statusCode } = await got('http://example.test/')

  t.equal(statusCode, 200)
  scope.done()
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

test('mocking succeeds even when host request header is not specified', t => {
  nock('http://example.test')
    .post('/resource')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.test/resource',
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

// https://github.com/nock/nock/issues/158
test('mikeal/request with strictSSL: true', t => {
  nock('https://example.test')
    .post('/what')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'https://example.test/what',
      strictSSL: true,
    },
    function(err, res, body) {
      t.type(err, 'null')
      t.equal(res && res.statusCode, 200)
      t.end()
    }
  )
})

test('.setNoDelay', t => {
  nock('http://example.test')
    .get('/yay')
    .reply(200, 'Hi')

  const req = http.request(
    {
      host: 'example.test',
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

test('request emits socket', t => {
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
  req.once('socket', function(socket) {
    t.equal(this, req)
    t.type(socket, Object)
    t.type(socket.getPeerCertificate(), 'string')
    t.end()
  })
})

test('socket emits connect and secureConnect', t => {
  t.plan(3)

  nock('http://example.test')
    .post('/')
    .reply(200, 'hey')

  const req = http.request({
    host: 'example.test',
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
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
  req.once('socket', function(socket) {
    socket.setKeepAlive(true)
    t.end()
  })
})

test('abort destroys socket', t => {
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
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
  nock('http://example.test')
    .get('/somepath')
    .reply(200, 'Yay hyperquest!')

  const req = hyperquest('http://example.test/somepath')
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
  nock(/regexexample\.test/)
    .get('/resources')
    .reply(200, 'Match regex')

  mikealRequest.get('http://regexexample.test/resources', function(
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
  nock(/.*/)
    .get(() => true)
    .reply(200, 'Match regex')

  mikealRequest.get('http://example.test/resources', function(err, res, body) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')
    t.end()
  })
})

test('match multiple interceptors with regexp domain (issue-508)', t => {
  nock(/chainregex/)
    .get('/')
    .reply(200, 'Match regex')
    .get('/')
    .reply(500, 'Match second intercept')

  mikealRequest.get('http://chainregex.test', function(err, res, body) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match regex')

    mikealRequest.get('http://chainregex.test', function(err, res, body) {
      t.type(err, 'null')
      t.equal(res.statusCode, 500)
      t.equal(body, 'Match second intercept')

      t.end()
    })
  })
})

test('match domain using intercept callback', t => {
  const validUrl = ['/cats', '/dogs']

  nock('http://example.test')
    .get(function(uri) {
      return validUrl.indexOf(uri) >= 0
    })
    .reply(200, 'Match intercept')
    .get('/cats')
    .reply(200, 'Match intercept 2')

  mikealRequest.get('http://example.test/cats', function(err, res, body) {
    t.type(err, 'null')
    t.equal(res.statusCode, 200)
    t.equal(body, 'Match intercept')

    // This one should match the second .get()
    mikealRequest.get('http://example.test/cats', function(err, res, body) {
      t.type(err, 'null')
      t.equal(res.statusCode, 200)
      t.equal(body, 'Match intercept 2')
      t.end()
    })
  })
})

test('match path using regexp', t => {
  nock('http://example.test')
    .get(/regex$/)
    .reply(200, 'Match regex')

  mikealRequest.get('http://example.test/resources/regex', function(
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
    hostname: 'example.test',
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

test('you must setup an interceptor for each request', t => {
  const scope = nock('http://example.test')
    .get('/hey')
    .reply(200, 'First match')

  mikealRequest.get('http://example.test/hey', function(error, res, body) {
    t.equal(res.statusCode, 200)
    t.equal(body, 'First match', 'should match first request response body')

    mikealRequest.get('http://example.test/hey', function(error, res, body) {
      t.equal(
        error && error.toString(),
        `Error: Nock: No match for request ${JSON.stringify(
          {
            method: 'GET',
            url: 'http://example.test/hey',
            headers: { host: 'example.test' },
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

test('no content type provided', t => {
  const scope = nock('http://example.test')
    .replyContentLength()
    .post('/httppost', function() {
      return true
    })
    .reply(401, '')

  http
    .request(
      {
        host: 'example.test',
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

// https://github.com/nock/nock/issues/835
test('match domain and path using regexp', t => {
  const imgResponse = 'Matched Images Page'

  const scope = nock(/example/)
    .get(/img/)
    .reply(200, imgResponse)

  mikealRequest.get('http://example.test/imghp?hl=en', function(
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

// https://github.com/nock/nock/issues/1003
test('correctly parse request without specified path', t => {
  const scope1 = nock('https://example.test')
    .get('')
    .reply(200)

  https
    .request({ hostname: 'example.test' }, function(res) {
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
  const scope1 = nock('https://example.test')
    .get('')
    .reply(200, 'this is data')

  https
    .request({ hostname: 'example.test' }, function(res) {
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

test('should throw expected error when creating request with missing options', t => {
  t.throws(() => http.request(), {
    message: 'Making a request with empty `options` is not supported in Nock',
  })
  t.end()
})

test('teardown', t => {
  let leaks = Object.keys(global).splice(globalCount, Number.MAX_VALUE)

  leaks = leaks.filter(function(key) {
    return acceptableLeaks.indexOf(key) == -1
  })

  t.deepEqual(leaks, [], 'No leaks')
  t.end()
})
