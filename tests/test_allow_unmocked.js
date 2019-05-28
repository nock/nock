'use strict'

const http = require('http')
const url = require('url')
const mikealRequest = require('request')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('with allowUnmocked, mocked request still works', async t => {
  const scope = nock('http://example.com', { allowUnmocked: true })
    .post('/post')
    .reply(200, '99problems')

  const { body, statusCode } = await got.post('http://example.com/post')
  t.equal(statusCode, 200)
  t.equal(body, '99problems')

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

            t.is(response.statusCode, 200, 'Do not intercept /')

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
        t.is(response.statusCode, 304, 'Intercept /abc')

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

test('allow unmocked post with json data', t => {
  t.plan(3)
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

    mikealRequest(options, function(err, resp) {
      t.error(err)
      t.equal(200, resp.statusCode)
      t.end()
    })
  })
})

test('allow unmocked passthrough with mismatched bodies', t => {
  t.plan(3)
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
      .post('/post', { some: 'other data' })
      .reply(404, 'Hey!')

    const options = {
      method: 'POST',
      uri: `http://localhost:${server.address().port}/post`,
      json: { some: 'data' },
    }

    mikealRequest(options, function(err, resp) {
      t.error(err)
      t.equal(200, resp.statusCode)
      t.end()
    })
  })
})

test('match path using regexp with allowUnmocked', t => {
  nock('http://example.test', { allowUnmocked: true })
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

// https://github.com/nock/nock/issues/835
test('match multiple paths to domain using regexp with allowUnmocked', async t => {
  const server = http.createServer((request, response) => {
    response.write('live')
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const url = `http://localhost:${server.address().port}`

  const scope1 = nock(/localhost/, { allowUnmocked: true })
    .get(/alpha/)
    .reply(200, 'this is alpha')

  const scope2 = nock(/localhost/, { allowUnmocked: true })
    .get(/bravo/)
    .reply(200, 'bravo, bravo!')

  t.equal((await got(`${url}`)).body, 'live')
  t.equal((await got(`${url}/alphalicious`)).body, 'this is alpha')
  t.equal((await got(`${url}/bravo-company`)).body, 'bravo, bravo!')

  scope1.done()
  scope2.done()
})

test('match domain and path using regexp with query params and allowUnmocked', t => {
  const imgResponse = 'Matched Images Page'
  const opts = { allowUnmocked: true }

  const scope = nock(/example/, opts)
    .get(/imghp\?hl=en/)
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

// https://github.com/nock/nock/issues/490
test('match when query is specified with allowUnmocked', async t => {
  const server = http.createServer((request, response) => {
    response.write('live')
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const url = `http://localhost:${server.address().port}`

  const scope = nock(url, { allowUnmocked: true })
    .get('/search')
    .query({ q: 'cat pictures' })
    .reply(200, '😻')

  t.equal((await got(url)).body, 'live')
  t.equal((await got(`${url}/search?q=cat%20pictures`)).body, '😻')

  scope.done()
})
