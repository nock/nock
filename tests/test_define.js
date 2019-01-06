'use strict'

const http = require('http')
const { test } = require('tap')
const got = require('got')
const nock = require('../.')

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

test('define() applies default status code when none is specified', async t => {
  const body = '�'
  const nockDef = {
    scope: 'http://example.test',
    method: 'POST',
    path: '/',
    body,
    response: '�',
  }

  const nocks = nock.define([nockDef])

  t.equal(nocks.length, 1)

  const { statusCode } = await got.post('http://example.test/', { body })

  t.equal(statusCode, 200)
})

test('define() applies default method when none is specified', async t => {
  const nocks = nock.define([
    {
      scope: 'http://example.test',
      status: 200,
      path: '/',
    },
  ])

  t.equal(nocks.length, 1)

  const { statusCode } = await got('http://example.test/')

  t.equal(statusCode, 200)
})

test('define() throws the expected error when scope and port conflict', t => {
  const nockDef = {
    scope: 'http://example.test:8080',
    port: 5000,
    method: 'POST',
    path: '/',
    body: 'Hello, world!',
    response: '�',
  }

  t.throws(() => nock.define([nockDef]), {
    message:
      'Mismatched port numbers in scope and port properties of nock definition.',
  })

  t.end()
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
