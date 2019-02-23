'use strict'

const { test } = require('tap')
const fs = require('fs')
const https = require('https')
const nock = require('..')
const ssl = require('./ssl')
const got = require('got')

require('./cleanup_after_each')()

test('Nock with allowUnmocked and an url match', async t => {
  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt'),
  }

  const server = https
    .createServer(options, (req, res) => {
      res.writeHead(200)
      res.end({ status: 'default' })
    })
    .listen(3000)

  const url = `https://127.0.0.1:${server.address().port}`

  nock(url, { allowUnmocked: true })
    .get('/urlMatch')
    .reply(201, JSON.stringify({ status: 'intercepted' }))

  const { body, statusCode } = await got(`${url}/urlMatch`, {
    rejectUnauthorized: false,
  })

  t.true(statusCode === 201)
  t.true(JSON.parse(body).status === 'intercepted')

  server.close()
})

test('Nock with allowUnmocked, url match and query false', async t => {
  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt'),
  }

  const server = https
    .createServer(options, (req, res) => {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'default' }))
    })
    .listen(3000)

  const url = `https://127.0.0.1:3000`

  nock(`${url}`, { allowUnmocked: true })
    .get('/')
    .query(false)
    .reply(200, { status: 'intercepted' })

  const { body } = await got(`${url}/otherpath`, {
    rejectUnauthorized: false,
  })

  t.true(JSON.parse(body).status === 'default')

  server.close()
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
