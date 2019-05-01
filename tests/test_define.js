'use strict'

const http = require('http')
const assertRejects = require('assert-rejects')
const { test } = require('tap')
const got = require('got')
const nock = require('..')

require('./cleanup_after_each')()

test('define() is backward compatible', async t => {
  t.ok(
    nock.define([
      {
        scope: 'http://example.com',
        //  "port" has been deprecated
        port: 12345,
        method: 'GET',
        path: '/',
        //  "reply" has been deprecated
        reply: '500',
      },
    ])
  )

  await assertRejects(
    got('http://example.com:12345/', { retry: 0 }),
    ({ statusCode }) => {
      t.is(statusCode, 500)
      return true
    }
  )
})

test('define() applies default status code when none is specified', async t => {
  const body = '�'

  t.equal(
    nock.define([
      {
        scope: 'http://example.test',
        method: 'POST',
        path: '/',
        body,
        response: '�',
      },
    ]).length,
    1
  )

  const { statusCode } = await got.post('http://example.test/', { body })

  t.equal(statusCode, 200)
})

test('define() works when scope and port are both specified', async t => {
  const body = 'Hello, world!'

  t.ok(
    nock.define([
      {
        scope: 'http://example.test:1451',
        port: 1451,
        method: 'POST',
        path: '/',
        body,
        response: '�',
      },
    ])
  )

  const { statusCode } = await got.post('http://example.test:1451/', { body })

  t.equal(statusCode, 200)

  t.end()
})

test('define() throws the expected error when scope and port conflict', t => {
  t.throws(
    () =>
      nock.define([
        {
          scope: 'http://example.test:8080',
          port: 5000,
          method: 'POST',
          path: '/',
          body: 'Hello, world!',
          response: '�',
        },
      ]),
    {
      message:
        'Mismatched port numbers in scope and port properties of nock definition.',
    }
  )

  t.end()
})

test('define() throws the expected error when method is missing', t => {
  t.throws(
    () =>
      nock.define([
        {
          scope: 'http://example.test',
          path: '/',
          body: 'Hello, world!',
          response: 'yo',
        },
      ]),
    {
      message: 'Method is required',
    }
  )

  t.end()
})

test('define() works with non-JSON responses', { only: true }, async t => {
  const exampleBody = '�'
  const exampleResponseBody = 'hey: �'

  t.ok(
    nock.define([
      {
        scope: 'http://example.test',
        method: 'POST',
        path: '/',
        body: exampleBody,
        status: 200,
        response: exampleResponseBody,
      },
    ])
  )

  const { statusCode, body } = await got.post('http://example.test/', {
    encoding: false,
    body: exampleBody,
  })

  t.equal(statusCode, 200)
  // TODO: beacuse `{ encoding: false }` is passed to `got`, `body` should be
  // a buffer, but it's a string. Is this a bug in nock or got?
  t.equal(body, exampleResponseBody)
})

// TODO: There seems to be a bug here. When testing via `got` with
// `{ encoding: false }` the body that comes back should be a buffer, but is
// not. It's difficult to get this test to pass after porting it.
test('define() works with binary buffers', t => {
  const exampleBody = '8001'
  const exampleResponse = '8001'

  t.ok(
    nock.define([
      {
        scope: 'http://example.com',
        method: 'POST',
        path: '/',
        body: exampleBody,
        status: 200,
        response: exampleResponse,
      },
    ])
  )

  const req = new http.request(
    {
      host: 'example.com',
      method: 'POST',
      path: '/',
    },
    res => {
      t.equal(res.statusCode, 200)

      const dataChunks = []

      res.on('data', chunk => {
        dataChunks.push(chunk)
      })

      res.once('end', () => {
        const response = Buffer.concat(dataChunks)
        t.equal(response.toString('hex'), exampleResponse, 'responses match')
        t.end()
      })
    }
  )

  req.on('error', err => {
    //  This should never happen.
    t.fail('Error should never occur.')
    t.end()
  })

  req.write(Buffer.from(exampleBody, 'hex'))
  req.end()
})

test('define() uses reqheaders', t => {
  const auth = 'foo:bar'
  const authHeader = `Basic ${Buffer.from('foo:bar').toString('base64')}`
  const reqheaders = {
    host: 'example.com',
    authorization: authHeader,
  }

  t.ok(
    nock.define([
      {
        scope: 'http://example.com',
        method: 'GET',
        path: '/',
        status: 200,
        reqheaders,
      },
    ])
  )

  // Make a request which should match the mock that was configured above.
  // This does not hit the network.
  const req = new http.request(
    {
      host: 'example.com',
      method: 'GET',
      path: '/',
      auth,
    },
    res => {
      t.equal(res.statusCode, 200)

      res.once('end', () => {
        t.equivalent(res.req._headers, reqheaders)
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
  t.ok(
    nock.define([
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
    ])
  )

  const req = new http.request(
    {
      host: 'example.com',
      method: 'GET',
      path: '/',
      headers: {
        'x-foo': 'bar',
      },
    },
    res => {
      t.equal(res.statusCode, 200)

      res.once('end', () => {
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )
  req.end()
})
