'use strict'

const { test } = require('tap')
const http = require('http')
const https = require('https')
const fs = require('fs')
const zlib = require('zlib')
const mikealRequest = require('request')
const superagent = require('superagent')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

let globalCount

test('setup', t => {
  globalCount = Object.keys(global).length
  t.end()
})

test('when request port is different, use the alternate port', async t => {
  nock.restore()
  nock.recorder.clear()
  nock.recorder.rec(true)

  const server = http.createServer((request, response) => response.end())
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))

  const { port } = server.address()
  t.notEqual(port, 80)

  await got.post(`http://localhost:${port}/`)

  const recorded = nock.recorder.play()
  t.equal(recorded.length, 1)
  t.true(recorded[0].includes(`nock('http://localhost:${port}',`))
})

test('recording turns off nock interception (backward compatibility behavior)', t => {
  //  We ensure that there are no overrides.
  nock.restore()
  t.false(nock.isActive())
  //  We active the nock overriding - as it's done by merely loading nock.
  nock.activate()
  t.true(nock.isActive())
  //  We start recording.
  nock.recorder.rec()
  //  Nothing happens (nothing has been thrown) - which was the original behavior -
  //  and mocking has been deactivated.
  t.false(nock.isActive())

  t.end()
})

test('records', async t => {
  t.plan(5)

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  nock.recorder.rec(true)

  await got.post(`http://localhost:${port}`)

  nock.restore()

  const recorded = nock.recorder.play()
  t.equal(recorded.length, 1)
  t.type(recorded[0], 'string')
  t.true(
    recorded[0].startsWith(
      `\nnock('http://localhost:${port}', {"encodedQueryParams":true})\n  .post('/')`
    )
  )
})

test('records objects', t => {
  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })

  t.once('end', () => {
    server.close()
  })

  server.listen(() => {
    const url = `http://localhost:${server.address().port}`
    const options = {
      method: 'POST',
      url,
      body: '012345',
    }

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    mikealRequest(options, () => {
      nock.restore()
      const ret = nock.recorder.play()
      t.equal(ret.length, 1)
      t.equal(ret[0].scope, url)
      t.equal(ret[0].method, 'POST')
      t.equal(ret[0].body, '012345')
      t.end()
    })
  })
})

test('logs recorded objects', async t => {
  t.plan(3)

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  const logging = log => {
    t.true(
      log.startsWith(
        '\n<<<<<<-- cut here -->>>>>>\n{\n  "scope": "http://localhost:'
      )
    )
  }

  nock.recorder.rec({
    logging,
    output_objects: true,
  })

  await got.post(`http://localhost:${port}`)

  nock.restore()
})

test('records objects and correctly stores JSON object in body', async t => {
  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const server = http.createServer((request, response) => response.end())
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  const exampleBody = { foo: 123 }

  await got.post(`http://localhost:${port}/`, {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(exampleBody),
  })

  nock.restore()
  const recorded = nock.recorder.play()
  nock.recorder.clear()
  nock.activate()

  t.equal(recorded.length, 1)

  // TODO See https://github.com/nock/nock/issues/1229

  // This is the current behavior: store body as decoded JSON.
  t.deepEqual(recorded[0].body, exampleBody)

  // This is the desired behavior: store the body as encoded JSON. The second
  // test shows desired behavior: store body as encoded JSON so that JSON
  // strings can be correctly matched at runtime. Because headers are not
  // stored in the recorder output, it is impossible for the loader to
  // differentiate a stored JSON string from a non-JSON body.
  // t.equal(recorded[0].body, JSON.stringify(exampleBody))
})

test('records and replays objects correctly', t => {
  const exampleText = '<html><body>example</body></html>'

  const server = http.createServer((request, response) => {
    switch (require('url').parse(request.url).pathname) {
      case '/':
        response.writeHead(302, { Location: '/abc' })
        break
      case '/abc':
        response.write(exampleText)
        break
    }
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    superagent.get(`http://localhost:${server.address().port}`, (err, resp) => {
      t.ok(!err)
      t.ok(resp)
      t.ok(resp.headers)
      t.strictEqual(resp.text, exampleText)

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      t.equal(recorded.length, 2)
      const nocks = nock.define(recorded)

      superagent.get(
        `http://localhost:${server.address().port}`,
        (mockedErr, mockedResp) => {
          t.equal(err, mockedErr)
          t.strictEqual(resp.text, exampleText)

          nocks.forEach(nock => nock.done())

          t.end()
        }
      )
    })
  })
})

test('records and replays correctly with filteringRequestBody', t => {
  const server = http.createServer((request, response) => {
    response.write('<html><body>example</body></html>')
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    superagent.get(`http://localhost:${server.address().port}`, (err, resp) => {
      t.ok(!err)
      t.ok(resp)
      t.ok(resp.headers)

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      t.equal(recorded.length, 1)
      let filteringRequestBodyCounter = 0
      const [definition] = recorded
      definition.filteringRequestBody = (body, aRecodedBody) => {
        ++filteringRequestBodyCounter
        t.strictEqual(body, aRecodedBody)
        return body
      }
      const nocks = nock.define([definition])

      superagent.get(
        `http://localhost:${server.address().port}`,
        (mockedErr, mockedResp) => {
          t.equal(err, mockedErr)
          t.deepEqual(mockedResp.body, resp.body)

          nocks.forEach(nock => nock.done())

          t.strictEqual(filteringRequestBodyCounter, 1)
          t.end()
        }
      )
    })
  })
})

// https://github.com/nock/nock/issues/29
test('checks if callback is specified', t => {
  // Use t.plan() to make sure the test doesn't end until the request has
  // returned _and_ the listen() callback has finished.
  t.plan(3)
  const server = http.createServer((request, response) => {
    response.write('<html><body>example</body></html>')
    response.end()
    t.pass()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec(true)
    http
      .request({
        host: 'localhost',
        port: server.address().port,
        method: 'GET',
        path: '/',
      })
      .end()
    nock.restore()
    t.pass()
  })
})

test('checks that data is specified', t => {
  nock.restore()
  nock.recorder.clear()
  nock.recorder.rec(true)

  const req = http.request({
    method: 'POST',
    host: 'localhost',
    path: '/',
    port: '80',
    body: undefined,
  })

  t.throws(() => req.write(), { message: 'Data was undefined.' })
  req.abort()
  t.end()
})

test('when request body is json, it goes unstringified', async t => {
  const server = http.createServer((request, response) => response.end())
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  nock.recorder.rec(true)

  const payload = { a: 1, b: true }

  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  await got.post(`http://localhost:${port}/`, { body: JSON.stringify(payload) })

  const recorded = nock.recorder.play()
  t.equal(recorded.length, 1)
  t.ok(recorded[0].includes('.post(\'/\', {"a":1,"b":true})'))
})

test('when request body is json, it goes unstringified in objects', async t => {
  const server = http.createServer((request, response) => response.end())
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  nock.recorder.rec({ dont_print: true, output_objects: true })

  const payload = { a: 1, b: true }

  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  await got.post(`http://localhost:${port}/`, { body: JSON.stringify(payload) })

  const recorded = nock.recorder.play()
  t.equal(recorded.length, 1)
  t.type(recorded[0], 'object')
  t.type(recorded[0].body, 'object')
  t.deepEqual(recorded[0].body, payload)
})

test('records nonstandard ports', t => {
  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const REQUEST_BODY = 'ABCDEF'
  const RESPONSE_BODY = '012345'

  //  Create test http server and perform the tests while it's up.
  const testServer = http
    .createServer((req, res) => {
      res.end(RESPONSE_BODY)
    })
    .listen(8082, err => {
      t.equal(err, undefined)

      const options = {
        host: 'localhost',
        port: testServer.address().port,
        path: '/',
      }
      const recOptions = {
        dont_print: true,
        output_objects: true,
      }

      nock.recorder.rec(recOptions)

      const req = http.request(options, res => {
        res.resume()
        res.once('end', () => {
          nock.restore()
          const ret = nock.recorder.play()
          t.equal(ret.length, 1)
          t.type(ret[0], 'object')
          t.equal(ret[0].scope, `http://localhost:${options.port}`)
          t.equal(ret[0].method, 'GET')
          t.equal(ret[0].body, REQUEST_BODY)
          t.equal(ret[0].status, 200)
          t.equal(ret[0].response, RESPONSE_BODY)
          t.end()

          // Close the test server, we are done with it.
          testServer.close()
        })
      })

      req.end(REQUEST_BODY)
    })
})

test('req.end accepts and calls a callback when recording', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec({ dont_print: true })

    let callbackCalled = false
    const req = http.request(
      {
        hostname: 'localhost',
        port: server.address().port,
        path: '/',
        method: 'GET',
      },
      res => {
        t.true(callbackCalled)
        t.equal(res.statusCode, 200)
        res.on('end', () => {
          t.end()
        })
        res.resume()
      }
    )

    req.end(() => {
      callbackCalled = true
    })
  })
})

test('rec() throws when reinvoked with already recorder requests', t => {
  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  nock.recorder.rec()
  try {
    nock.recorder.rec()
    //  This line should never be reached.
    t.ok(false)
    t.end()
  } catch (e) {
    t.equal(e.toString(), 'Error: Nock recording already in progress')
    t.end()
  }
})

test('records https correctly', t => {
  const server = https.createServer(
    {
      key: fs.readFileSync('tests/ssl/ca.key'),
      cert: fs.readFileSync('tests/ssl/ca.crt'),
    },
    (request, response) => {
      response.write('<html><body>example</body></html>')
      response.end()
    }
  )
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    https
      .request(
        {
          method: 'POST',
          host: 'localhost',
          port: server.address().port,
          path: '/',
          rejectUnauthorized: false,
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()
            const recorded = nock.recorder.play()
            t.equal(recorded.length, 1)
            t.type(recorded[0], 'object')
            t.equal(
              recorded[0].scope,
              `https://localhost:${server.address().port}`
            )
            t.equal(recorded[0].method, 'POST')
            t.ok(typeof recorded[0].status !== 'undefined')
            t.ok(typeof recorded[0].response !== 'undefined')
            t.end()
          })
        }
      )
      .end('012345')
  })
})

test('records request headers correctly as an object', t => {
  const server = http.createServer((request, response) => response.end())
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
      enable_reqheaders_recording: true,
    })

    http
      .request(
        {
          hostname: 'localhost',
          port: server.address().port,
          path: '/',
          method: 'GET',
          auth: 'foo:bar',
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()
            const recorded = nock.recorder.play()
            t.equal(recorded.length, 1)
            t.type(recorded[0], 'object')
            t.equivalent(recorded[0].reqheaders, {
              host: `localhost:${server.address().port}`,
              authorization: `Basic ${Buffer.from('foo:bar').toString(
                'base64'
              )}`,
            })
            t.end()
          })
        }
      )
      .end()
  })
})

test('records request headers correctly when not outputting objects', async t => {
  t.plan(5)

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  nock.recorder.rec({
    dont_print: true,
    enable_reqheaders_recording: true,
  })

  await got.post(`http://localhost:${port}`, { headers: { 'X-Foo': 'bar' } })

  nock.restore()

  const recorded = nock.recorder.play()
  t.equal(recorded.length, 1)
  t.type(recorded[0], 'string')
  t.true(recorded[0].includes('  .matchHeader("x-foo", "bar")'))
})

test('records and replays gzipped nocks correctly', t => {
  const exampleText = '<html><body>example</body></html>'

  const server = http.createServer((request, response) => {
    zlib.gzip(exampleText, (err, result) => {
      t.notOk(err)
      response.writeHead(200, { 'content-encoding': 'gzip' })
      response.end(result)
    })
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    superagent.get(`localhost:${server.address().port}`, (err, resp) => {
      t.ok(!err)
      t.ok(resp)
      t.ok(resp.headers)
      t.equal(resp.headers['content-encoding'], 'gzip')
      t.equal(resp.text, exampleText)

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      t.equal(recorded.length, 1)
      const nocks = nock.define(recorded)

      superagent.get(
        `localhost:${server.address().port}`,
        (mockedErr, mockedResp) => {
          t.equal(err, mockedErr)
          t.deepEqual(mockedResp.text, exampleText)
          t.equal(mockedResp.headers['content-encoding'], 'gzip')

          nocks.forEach(nock => nock.done())

          t.end()
        }
      )
    })
  })
})

test('records and replays nocks correctly', t => {
  const exampleBody = '<html><body>example</body></html>'

  const server = http.createServer((request, response) => {
    switch (require('url').parse(request.url).pathname) {
      case '/':
        response.writeHead(302, { Location: '/abc' })
        break
      case '/abc':
        response.write(exampleBody)
        break
    }
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    mikealRequest(
      `http://localhost:${server.address().port}`,
      (err, resp, body) => {
        t.notOk(err)
        t.ok(resp)
        t.equal(body, exampleBody)

        nock.restore()
        const recorded = nock.recorder.play()
        nock.recorder.clear()
        nock.activate()

        // Two requests, on account of the redirect.
        t.equal(recorded.length, 2)
        const nocks = nock.define(recorded)

        mikealRequest(
          `http://localhost:${server.address().port}`,
          (mockedErr, mockedResp, mockedBody) => {
            t.notOk(mockedErr)
            t.equal(mockedBody, exampleBody)

            nocks.forEach(nock => nock.done())

            t.end()
          }
        )
      }
    )
  })
})

test("doesn't record request headers by default", t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    http
      .request(
        {
          hostname: 'localhost',
          port: server.address().port,
          path: '/',
          method: 'GET',
          auth: 'foo:bar',
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()
            const ret = nock.recorder.play()
            t.equal(ret.length, 1)
            t.type(ret[0], 'object')
            t.false(ret[0].reqheaders)
            t.end()
          })
        }
      )
      .end()
  })
})

test('will call a custom logging function', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  // This also tests that use_separator is on by default.
  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const record = []
  const arrayLog = content => {
    record.push(content)
  }

  server.listen(() => {
    nock.recorder.rec({
      logging: arrayLog,
    })

    http
      .request(
        {
          hostname: 'localhost',
          port: server.address().port,
          path: '/',
          method: 'GET',
          auth: 'foo:bar',
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()

            t.equal(record.length, 1)
            t.type(record[0], 'string')
            t.end()
          })
        }
      )
      .end()
  })
})

test('use_separator:false is respected', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  const record = []
  const arrayLog = content => {
    record.push(content)
  }

  server.listen(() => {
    nock.recorder.rec({
      logging: arrayLog,
      output_objects: true,
      use_separator: false,
    })

    http
      .request(
        {
          hostname: 'localhost',
          port: server.address().port,
          path: '/',
          method: 'GET',
          auth: 'foo:bar',
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()
            t.equal(record.length, 1)
            t.type(record[0], 'object') // this is still an object, because the "cut here" strings have not been appended
            t.end()
          })
        }
      )
      .end()
  })
})

test('records request headers except user-agent if enable_reqheaders_recording is set to true', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
      enable_reqheaders_recording: true,
    })

    http
      .request(
        {
          hostname: 'localhost',
          port: server.address().port,
          path: '/',
          method: 'GET',
          auth: 'foo:bar',
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()
            const ret = nock.recorder.play()
            t.equal(ret.length, 1)
            t.type(ret[0], 'object')
            t.true(ret[0].reqheaders)
            t.false(ret[0].reqheaders['user-agent'])
            t.end()
          })
        }
      )
      .end()
  })
})

test('includes query parameters from superagent', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    superagent
      .get(`http://localhost:${server.address().port}`)
      .query({ q: 'test search' })
      .end(() => {
        nock.restore()
        const ret = nock.recorder.play()
        t.true(ret.length >= 1)
        t.equal(ret[0].path, '/?q=test%20search')
        t.end()
      })
  })
})

test('encodes the query parameters when not outputting objects', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: false,
    })

    superagent
      .get(`http://localhost:${server.address().port}`)
      .query({ q: 'test search++' })
      .end(() => {
        nock.restore()
        const recording = nock.recorder.play()
        t.true(recording.length >= 1)
        t.true(recording[0].indexOf('test%20search%2B%2B') !== -1)
        t.end()
      })
  })
})

test('works with clients listening for readable', t => {
  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)
  t.once('end', () => nock.restore())

  const requestBody = 'ABCDEF'
  const responseBody = '012345'

  const server = http.createServer((req, res) => {
    res.end(responseBody)
  })
  t.once('end', () => server.close())

  server.listen(() => {
    nock.recorder.rec({ dont_print: true, output_objects: true })

    http
      .request(
        {
          host: 'localhost',
          port: server.address().port,
          path: '/',
        },
        res => {
          let readableCount = 0
          let chunkCount = 0

          res.on('readable', () => {
            ++readableCount
            let chunk
            while ((chunk = res.read()) !== null) {
              t.equal(chunk.toString(), responseBody)
              ++chunkCount
            }
          })

          res.once('end', () => {
            t.equal(readableCount, 1)
            t.equal(chunkCount, 1)

            const recorded = nock.recorder.play()
            t.equal(recorded.length, 1)
            t.type(recorded[0], 'object')
            t.equal(
              recorded[0].scope,
              `http://localhost:${server.address().port}`
            )
            t.equal(recorded[0].method, 'GET')
            t.equal(recorded[0].body, requestBody)
            t.equal(recorded[0].status, 200)
            t.equal(recorded[0].response, responseBody)

            t.end()
          })
        }
      )
      .end(requestBody)
  })
})

test('outputs query string parameters using query()', t => {
  t.plan(7)

  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec(true)

    superagent
      .get(`http://localhost:${server.address().port}/`)
      .query({ param1: 1, param2: 2 })
      .end((err, resp) => {
        t.notOk(err)
        t.ok(resp, 'have response')
        t.ok(resp.headers, 'have headers')

        const recorded = nock.recorder.play()
        t.equal(recorded.length, 1)
        t.type(recorded[0], 'string')
        t.ok(recorded[0].includes(`.query({"param1":"1","param2":"2"})`))
        t.end()
      })
  })
})

test('outputs query string arrays correctly', t => {
  t.plan(7)

  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  server.listen(() => {
    nock.recorder.rec(true)

    superagent
      .get(`http://localhost:${server.address().port}/`)
      .query({ foo: ['bar', 'baz'] })
      .end((err, resp) => {
        t.notOk(err)
        t.ok(resp, 'have response')
        t.ok(resp.headers, 'have headers')

        const recorded = nock.recorder.play()
        t.equal(recorded.length, 1)
        t.type(recorded[0], 'string')
        t.ok(recorded[0].includes(`.query({"foo":["bar","baz"]})`))
        t.end()
      })
  })
})

test('removes query params from the path and puts them in query()', t => {
  t.plan(5)

  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)
  t.once('end', () => nock.restore())

  server.listen(() => {
    nock.recorder.rec(true)
    http
      .request(
        {
          method: 'POST',
          host: 'localhost',
          port: server.address().port,
          path: '/?param1=1&param2=2',
        },
        res => {
          res.resume()
          res.once('end', () => {
            const recorded = nock.recorder.play()
            t.equal(recorded.length, 1)
            t.type(recorded[0], 'string')
            t.ok(
              recorded[0].includes(
                `nock('http://localhost:${server.address().port}',`
              )
            )
            t.ok(recorded[0].includes(`.query({"param1":"1","param2":"2"})`))
            t.end()
          })
        }
      )
      .end('ABCDEF')
  })
})

test('respects http.request() consumers', t => {
  //  Create test http server and perform the tests while it's up.
  const testServer = http
    .createServer((req, res) => {
      res.write('foo')
      setTimeout(() => {
        res.end('bar')
      }, 25)
    })
    .listen(8083, err => {
      t.equal(err, undefined)

      nock.restore()
      nock.recorder.clear()
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
      })

      const options = {
        host: 'localhost',
        port: testServer.address().port,
        path: '/',
      }
      const req = http.request(
        options,
        res => {
          let buffer = Buffer.from('')

          setTimeout(() => {
            res
              .on('data', data => {
                buffer = Buffer.concat([buffer, data])
              })
              .on('end', () => {
                nock.restore()
                t.equal(buffer.toString(), 'foobar')
                t.end()

                //  Close the test server, we are done with it.
                testServer.close()
              })
          })
        },
        50
      )

      req.end()
    })
})

test('records and replays binary response correctly', t => {
  nock.restore()
  nock.recorder.clear()
  t.equal(nock.recorder.play().length, 0)

  nock.recorder.rec({
    output_objects: true,
    dont_print: true,
  })

  const transparentGifHex =
    '47494638396101000100800000000000ffffff21f90401000000002c000000000100010000020144003b'
  const transparentGifBuffer = Buffer.from(transparentGifHex, 'hex')

  // start server that always responds with transparent gif at available port
  const server = http.createServer((request, response) => {
    response.writeHead(201, {
      'Content-Type': 'image/gif',
      'Content-Length': transparentGifBuffer.length,
    })
    response.write(transparentGifBuffer, 'binary')
    response.end()
  })

  server.listen(0, error => {
    t.error(error)

    // send post request upload the same image to server
    const postRequestOptions = {
      method: 'PUT',
      host: 'localhost',
      port: server.address().port,
      path: '/clear.gif',
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': transparentGifBuffer.length,
      },
    }
    const postRequest1 = http.request(postRequestOptions, response => {
      const data = []

      response.on('data', chunk => {
        data.push(chunk)
      })

      response.on('end', () => {
        const result = Buffer.concat(data).toString('hex')
        t.equal(result, transparentGifHex, 'received gif equals check value')

        const recordedFixtures = nock.recorder.play()

        // stop server, stop recording, start intercepting
        server.close(error => {
          t.error(error)

          nock.restore()
          nock.activate()
          nock.define(recordedFixtures)

          // send same post request again
          const postRequest2 = http.request(postRequestOptions, response => {
            const data = []

            response.on('data', chunk => {
              data.push(chunk)
            })

            response.on('end', () => {
              const result = Buffer.concat(data).toString('hex')

              // expect same outcome, end tests
              t.equal(
                result,
                transparentGifHex,
                'received gif equals check value'
              )
              t.end()
            })
          })

          postRequest2.write(transparentGifBuffer)
          postRequest2.end()
        })
      })
    })

    postRequest1.write(transparentGifBuffer)
    postRequest1.end()
  })
})

test('teardown', t => {
  let leaks = Object.keys(global).splice(globalCount, Number.MAX_VALUE)

  if (leaks.length === 1 && leaks[0] === '_key') {
    leaks = []
  }
  t.deepEqual(leaks, [], 'No leaks')
  t.end()
})
