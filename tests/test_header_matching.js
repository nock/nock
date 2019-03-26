'use strict'

const http = require('http')
const domain = require('domain')
const assertRejects = require('assert-rejects')
const { test } = require('tap')
const got = require('got')
const mikealRequest = require('request')
const nock = require('..')

require('./cleanup_after_each')()

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

  scope.done()
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

test('match header on scope with function: gets the expected argument', async t => {
  t.plan(3)

  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', val => {
      // TODO: It's surprising that this function receives a number instead of
      // a string. Probably this behavior should be changed.
      t.equal(val, 456)
      return true
    })
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 456 },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('match header on scope with function: matches when match accepted', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', val => true)
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 456 },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('match header on scope with function: does not match when match declined', async t => {
  nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', val => false)
    .reply(200, 'Hello World!')

  await assertRejects(
    got('http://example.test/', {
      headers: { 'X-My-Headers': 456 },
    }),
    Error,
    'Nock: No match for request'
  )
})

test('match header on scope with function: does not consume mock request when match declined', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('x-my-headers', val => false)
    .reply(200, 'Hello World!')

  await assertRejects(
    got('http://example.test/', {
      headers: { '-My-Headers': 456 },
    }),
    Error,
    'Nock: No match for request'
  )
  t.throws(() => scope.done(), {
    message: 'Mocks not yet satisfied',
  })
})

test('match header on intercept with function: gets the expected argument', async t => {
  t.plan(3)

  const scope = nock('http://example.test')
    .matchHeader('x-my-headers', val => {
      // TODO: It's surprising that this function receives a number instead of
      // a string. Probably this behavior should be changed.
      t.equal(val, 456)
      return true
    })
    // `.matchHeader()` is called on the interceptor. It precedes the call to
    // `.get()`.
    .get('/')
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 456 },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('match header on interceptor with function: matches when match accepted', async t => {
  const scope = nock('http://example.test')
    .matchHeader('x-my-headers', val => true)
    // `.matchHeader()` is called on the interceptor. It precedes the call to
    // `.get()`.
    .get('/')
    .reply(200, 'Hello World!')

  const { statusCode, body } = await got('http://example.test/', {
    headers: { 'X-My-Headers': 456 },
  })

  t.equal(statusCode, 200)
  t.equal(body, 'Hello World!')
  scope.done()
})

test('match header on interceptor with function: does not match when match declined', async t => {
  nock('http://example.test')
    .matchHeader('x-my-headers', val => false)
    // `.matchHeader()` is called on the interceptor. It precedes the call to
    // `.get()`.
    .get('/')
    .reply(200, 'Hello World!')

  await assertRejects(
    got('http://example.test/', {
      headers: { 'X-My-Headers': 456 },
    }),
    Error,
    'Nock: No match for request'
  )
})

test('match header on interceptor with function: does not consume mock request when match declined', async t => {
  const scope = nock('http://example.test')
    .matchHeader('x-my-headers', val => false)
    // `.matchHeader()` is called on the interceptor. It precedes the call to
    // `.get()`.
    .get('/')
    .reply(200, 'Hello World!')

  await assertRejects(
    got('http://example.test/', {
      headers: { '-My-Headers': 456 },
    }),
    Error,
    'Nock: No match for request'
  )
  t.throws(() => scope.done(), {
    message: 'Mocks not yet satisfied',
  })
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

test('done fails when specified request header is missing', t => {
  nock('http://example.test', {
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
      uri: 'http://example.test/resource',
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
  nock('http://example.test', {
    reqheaders: {
      'X-My-Super-Power': /.+/,
    },
  })
    .post('/superpowers')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.test/superpowers',
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
  nock('http://example.test', {
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
      uri: 'http://example.test/superpowers',
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
  nock('http://example.test', {
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
      uri: 'http://example.test/superpowers',
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
  nock('http://example.test', {
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
      uri: 'http://example.test/superpowers',
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
  nock('http://example.test', {
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
      uri: 'http://example.test/resource',
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
  nock('http://example.test', {
    badheaders: ['cookie'],
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  const d = domain.create()

  d.run(function() {
    mikealRequest({
      method: 'POST',
      uri: 'http://example.test/resource',
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

test('mocking succeeds even when mocked and specified request header names have different cases', t => {
  nock('http://example.test', {
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

// https://github.com/nock/nock/issues/966
test('mocking succeeds when mocked and specified request headers have falsy values', t => {
  nock('http://example.test', {
    reqheaders: {
      'x-foo': 0,
    },
  })
    .post('/resource')
    .reply(200, { status: 'ok' })

  mikealRequest(
    {
      method: 'POST',
      uri: 'http://example.test/resource',
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

test('match basic authentication header', t => {
  const username = 'testuser'
  const password = 'testpassword'
  const authString = `${username}:${password}`

  const expectedAuthHeader = `Basic ${Buffer.from(authString).toString(
    'base64'
  )}`

  const scope = nock('http://example.test')
    .get('/')
    .matchHeader('Authorization', val => val === expectedAuthHeader)
    .reply(200, 'Hello World!')

  http.get(
    {
      host: 'example.test',
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

test('multiple interceptors override headers from unrelated request', t => {
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

  mikealRequest(
    {
      url: 'https://example.test/bar',
      headers: {
        'x-foo': 'bar',
      },
    },
    function(err, res, body) {
      t.error(err)
      t.equal(res.statusCode, 200)

      mikealRequest.get(
        {
          url: 'https://example.test/baz',
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
