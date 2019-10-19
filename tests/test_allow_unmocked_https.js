'use strict'

const { test } = require('tap')
const fs = require('fs')
const https = require('https')
const nock = require('..')
const ssl = require('./ssl')
const got = require('./got_client')

require('./cleanup_after_each')()

test('Nock with allowUnmocked and an url match', async t => {
  const server = https.createServer(
    {
      key: fs.readFileSync('tests/ssl/ca.key'),
      cert: fs.readFileSync('tests/ssl/ca.crt'),
    },
    (req, res) => {
      res.writeHead(200)
      res.end({ status: 'default' })
    }
  )
  t.on('end', () => server.close())

  await new Promise(resolve => server.listen(resolve))

  const url = `https://127.0.0.1:${server.address().port}`

  const scope = nock(url, { allowUnmocked: true })
    .get('/urlMatch')
    .reply(201, JSON.stringify({ status: 'intercepted' }))

  const { body, statusCode } = await got(`${url}/urlMatch`, {
    rejectUnauthorized: false,
  })

  t.is(statusCode, 201)
  t.equal(JSON.parse(body).status, 'intercepted')
  scope.done()
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

    const commonRequestOptions = {
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
        .request({ path: '/', ...commonRequestOptions }, res => {
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
        .request({ path: '/does/not/exist', ...commonRequestOptions }, res => {
          t.equal(404, res.statusCode, 'real google response status code')
          res.on('data', function() {})
          res.on('end', secondIsDone)
        })
        .end()
    }

    https
      .request({ path: '/abc', ...commonRequestOptions }, res => {
        res.on('end', firstIsDone)
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      })
      .end()
  })
})

test('allow unmocked option works with https for a partial match', t => {
  // The `allowUnmocked` option is processed in two places. Once in the intercept when there
  // are no interceptors that come close to matching the request. And again in the overrider when
  // there are interceptors that partially match, eg just path, but don't completely match.
  // This explicitly tests the later case in the overrider by making an HTTPS request for a path
  // that has an interceptor but fails to match the query constraint.

  function middleware(request, response) {
    response.writeHead(201)
    response.write('foo')
    response.end()
  }

  ssl.startServer(middleware, function(error, server) {
    t.error(error)

    const { port } = server.address()
    const origin = `https://localhost:${port}`

    nock(origin, { allowUnmocked: true })
      .get('/foo')
      .query({ foo: 'bar' })
      .reply(418)

    // no query so wont match the interceptor
    got(`${origin}/foo`, { rejectUnauthorized: false }).then(
      ({ body, statusCode }) => {
        t.is(statusCode, 201)
        t.is(body, 'foo')
        server.close(t.end)
      }
    )
  })
})
