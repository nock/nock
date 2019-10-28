'use strict'

const { test } = require('tap')
const http = require('http')
const https = require('https')
const fs = require('fs')
const zlib = require('zlib')
const mikealRequest = require('request')
const superagent = require('superagent')
const sinon = require('sinon')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

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
  expect(port).not.to.equal(80)

  await got.post(`http://localhost:${port}/`)

  const recorded = nock.recorder.play()
  expect(recorded).to.have.lengthOf(1)
  expect(recorded[0]).to.include(`nock('http://localhost:${port}',`)
})

test('recording turns off nock interception (backward compatibility behavior)', t => {
  //  We ensure that there are no overrides.
  nock.restore()
  expect(nock.isActive()).to.be.false()
  //  We active the nock overriding - as it's done by merely loading nock.
  nock.activate()
  expect(nock.isActive()).to.be.true()
  //  We start recording.
  nock.recorder.rec()
  //  Nothing happens (nothing has been thrown) - which was the original behavior -
  //  and mocking has been deactivated.
  expect(nock.isActive()).to.be.false()

  t.end()
})

test('records', async t => {
  const gotRequest = sinon.spy()

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  const server = http.createServer((request, response) => {
    gotRequest()
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  nock.recorder.rec(true)

  await got.post(`http://localhost:${port}`)

  expect(gotRequest).to.have.been.calledOnce()

  nock.restore()

  const recorded = nock.recorder.play()
  expect(recorded).to.have.lengthOf(1)
  expect(recorded[0]).to.be.a('string')
  // TODO: Use chai-string?
  expect(
    recorded[0].startsWith(
      `\nnock('http://localhost:${port}', {"encodedQueryParams":true})\n  .post('/')`
    )
  ).to.be.true()
})

test('records objects', t => {
  const gotRequest = sinon.spy()

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  const server = http.createServer((request, response) => {
    gotRequest()
    response.writeHead(200)
    response.end()
  })

  t.once('end', () => {
    server.close()
  })

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const url = `http://localhost:${server.address().port}`
    mikealRequest(
      {
        method: 'POST',
        url,
        body: '012345',
      },
      () => {
        expect(gotRequest).to.have.been.calledOnce()
        nock.restore()
        const recorded = nock.recorder.play()
        expect(recorded).to.have.lengthOf(1)
        expect(recorded[0]).to.include({
          scope: url,
          method: 'POST',
          body: '012345',
        })
        t.end()
      }
    )
  })
})

test('logs recorded objects', async t => {
  const gotRequest = sinon.spy()
  const loggingFn = sinon.spy()

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  const server = http.createServer((request, response) => {
    gotRequest()
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const { port } = server.address()

  nock.recorder.rec({
    logging: loggingFn,
    output_objects: true,
  })

  await got.post(`http://localhost:${port}`)

  expect(gotRequest).to.have.been.calledOnce()
  expect(loggingFn).to.have.been.calledOnce()
  expect(
    loggingFn
      .getCall(0)
      .args[0].startsWith(
        '\n<<<<<<-- cut here -->>>>>>\n{\n  "scope": "http://localhost:'
      )
  ).to.be.true()

  nock.restore()
})

test('records objects and correctly stores JSON object in body', async t => {
  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

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

  expect(recorded).to.have.lengthOf(1)

  // TODO See https://github.com/nock/nock/issues/1229

  // This is the current behavior: store body as decoded JSON.
  expect(recorded[0]).to.deep.include({ body: exampleBody })

  // This is the desired behavior: store the body as encoded JSON. The second
  // test shows desired behavior: store body as encoded JSON so that JSON
  // strings can be correctly matched at runtime. Because headers are not
  // stored in the recorder output, it is impossible for the loader to
  // differentiate a stored JSON string from a non-JSON body.
  // expect(recorded[0]).to.include({ body: JSON.stringify(exampleBody) })
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
  expect(nock.recorder.play()).to.be.empty()

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    superagent.get(`http://localhost:${server.address().port}`, (err, resp) => {
      expect(err).to.be.null()
      expect(resp).to.be.ok()
      expect(resp.headers).to.be.ok()
      expect(resp).to.include({ text: exampleText })

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      expect(recorded).to.have.lengthOf(2)
      const nocks = nock.define(recorded)

      superagent.get(
        `http://localhost:${server.address().port}`,
        (mockedErr, mockedResp) => {
          expect(err).to.equal(mockedErr)
          expect(resp).to.include({ text: exampleText })

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
  expect(nock.recorder.play()).to.be.empty()

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    superagent.get(`http://localhost:${server.address().port}`, (err, resp) => {
      expect(err).to.be.null()
      expect(resp).to.be.ok()
      expect(resp.headers).to.be.ok()

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      expect(recorded).to.have.lengthOf(1)
      const onFilteringRequestBody = sinon.spy()
      const [definition] = recorded
      definition.filteringRequestBody = (body, aRecodedBody) => {
        onFilteringRequestBody()
        expect(body).to.equal(aRecodedBody)
        return body
      }
      const nocks = nock.define([definition])

      superagent.get(
        `http://localhost:${server.address().port}`,
        (mockedErr, mockedResp) => {
          expect(err).to.equal(mockedErr)
          expect(mockedResp).to.deep.include({ body: resp.body })

          nocks.forEach(nock => nock.done())

          expect(onFilteringRequestBody).to.have.been.calledOnce()
          t.end()
        }
      )
    })
  })
})

// https://github.com/nock/nock/issues/29
test('http request without callback should not crash', t => {
  const serverFinished = sinon.spy()

  const server = http.createServer((request, response) => {
    response.write('<html><body>example</body></html>')
    response.end()
    expect(serverFinished).to.have.been.calledOnce()
    t.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

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
    serverFinished()
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

  expect(() => req.write()).to.throw(Error, 'Data was undefined.')
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
  expect(recorded).to.have.lengthOf(1)
  expect(recorded[0]).to.include('.post(\'/\', {"a":1,"b":true})')
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
  expect(recorded).to.have.lengthOf(1)
  expect(recorded[0]).to.be.an('object')
  expect(recorded[0].body)
    .to.be.an('object')
    .and.deep.equal(payload)
})

test('records nonstandard ports', t => {
  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  const requestBody = 'ABCDEF'
  const responseBody = '012345'

  const server = http.createServer((req, res) => {
    res.end(responseBody)
  })

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const { port } = server.address()
    // Confidence check that we have a non-standard port.
    expect(port).to.be.greaterThan(8000)
    const req = http.request(
      {
        host: 'localhost',
        port,
        path: '/',
      },
      res => {
        res.resume()
        res.once('end', () => {
          nock.restore()
          const recorded = nock.recorder.play()
          expect(recorded).to.have.lengthOf(1)
          expect(recorded[0])
            .to.be.an('object')
            .and.include({
              scope: `http://localhost:${port}`,
              method: 'GET',
              body: requestBody,
              status: 200,
              response: responseBody,
            })
          t.end()
          server.close()
        })
      }
    )

    req.end(requestBody)
  })
})

test('req.end accepts and calls a callback when recording', t => {
  const onEnd = sinon.spy()

  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  server.listen(() => {
    nock.recorder.rec({ dont_print: true })

    const req = http.request(
      {
        hostname: 'localhost',
        port: server.address().port,
        path: '/',
        method: 'GET',
      },
      res => {
        expect(onEnd).to.have.been.calledOnce()
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          t.end()
        })
        res.resume()
      }
    )

    req.end(onEnd)
  })
})

test('rec() throws when reinvoked with already recorder requests', t => {
  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  nock.recorder.rec()
  expect(() => nock.recorder.rec()).to.throw(
    Error,
    'Nock recording already in progress'
  )
  t.end()
})

test('records https correctly', t => {
  const requestBody = '012345'
  const responseBody = '<html><body>example</body></html>'

  const server = https.createServer(
    {
      key: fs.readFileSync('tests/ssl/ca.key'),
      cert: fs.readFileSync('tests/ssl/ca.crt'),
    },
    (request, response) => {
      response.write(responseBody)
      response.end()
    }
  )
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    const { port } = server.address()
    https
      .request(
        {
          method: 'POST',
          host: 'localhost',
          port,
          path: '/',
          rejectUnauthorized: false,
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()
            const recorded = nock.recorder.play()
            expect(recorded).to.have.lengthOf(1)
            expect(recorded[0])
              .to.be.an('object')
              .and.to.include({
                scope: `https://localhost:${port}`,
                method: 'POST',
                body: requestBody,
                status: 200,
                response: responseBody,
              })
            t.end()
          })
        }
      )
      .end(requestBody)
  })
})

test('records request headers correctly as an object', t => {
  const server = http.createServer((request, response) => response.end())
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
      enable_reqheaders_recording: true,
    })

    const { port } = server.address()
    http
      .request(
        {
          hostname: 'localhost',
          port,
          path: '/',
          method: 'GET',
          auth: 'foo:bar',
        },
        res => {
          res.resume()
          res.once('end', () => {
            nock.restore()
            const recorded = nock.recorder.play()
            expect(recorded).to.have.lengthOf(1)
            expect(recorded[0])
              .to.be.an('object')
              .and.deep.include({
                reqheaders: {
                  host: `localhost:${port}`,
                  authorization: `Basic ${Buffer.from('foo:bar').toString(
                    'base64'
                  )}`,
                },
              })
            t.end()
          })
        }
      )
      .end()
  })
})

test('records request headers correctly when not outputting objects', async t => {
  const gotRequest = sinon.spy()

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  const server = http.createServer((request, response) => {
    gotRequest()
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
  expect(gotRequest).to.have.been.calledOnce()

  nock.restore()

  const recorded = nock.recorder.play()
  expect(recorded).to.have.lengthOf(1)
  expect(recorded[0])
    .to.be.a('string')
    .and.include('  .matchHeader("x-foo", "bar")')
})

test('records and replays gzipped nocks correctly', t => {
  const exampleText = '<html><body>example</body></html>'

  const server = http.createServer((request, response) => {
    zlib.gzip(exampleText, (err, result) => {
      expect(err).to.be.null()
      response.writeHead(200, { 'content-encoding': 'gzip' })
      response.end(result)
    })
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  nock.recorder.rec({
    dont_print: true,
    output_objects: true,
  })

  server.listen(() => {
    const { port } = server.address()
    superagent.get(`localhost:${port}`, (err, resp) => {
      expect(err).to.be.null()
      expect(resp).to.deep.include({
        text: exampleText,
      })
      expect(resp.headers).to.include({ 'content-encoding': 'gzip' })

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      expect(recorded).to.have.lengthOf(1)
      const nocks = nock.define(recorded)

      superagent.get(`localhost:${port}`, (mockedErr, mockedResp) => {
        expect(err).to.equal(mockedErr)
        expect(mockedResp).to.include({ text: exampleText })
        expect(mockedResp.headers).to.include({ 'content-encoding': 'gzip' })

        nocks.forEach(nock => nock.done())

        t.end()
      })
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
  expect(nock.recorder.play()).to.be.empty()

  server.listen(() => {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const { port } = server.address()
    mikealRequest(`http://localhost:${port}`, (err, resp, body) => {
      expect(err).to.be.null()
      expect(resp).to.be.ok()
      expect(body).to.equal(exampleBody)

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      // Two requests, on account of the redirect.
      expect(recorded).to.have.lengthOf(2)
      const nocks = nock.define(recorded)

      mikealRequest(
        `http://localhost:${port}`,
        (mockedErr, mockedResp, mockedBody) => {
          expect(mockedErr).to.be.null()
          expect(mockedBody).to.equal(exampleBody)

          nocks.forEach(nock => nock.done())

          t.end()
        }
      )
    })
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
  expect(nock.recorder.play()).to.be.empty()

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
            const recorded = nock.recorder.play()
            expect(recorded).to.have.lengthOf(1)
            expect(recorded[0]).to.be.an('object')
            expect(recorded[0].reqheaders).to.be.undefined()
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
  expect(nock.recorder.play()).to.be.empty()

  server.listen(() => {
    const loggingFn = sinon.spy()
    nock.recorder.rec({ logging: loggingFn })

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

            expect(loggingFn).to.have.been.calledOnce()
            expect(loggingFn.getCall(0).args[0]).to.be.a('string')
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
  expect(nock.recorder.play()).to.be.empty()

  server.listen(() => {
    const loggingFn = sinon.spy()
    nock.recorder.rec({
      logging: loggingFn,
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
            expect(loggingFn).to.have.been.calledOnce()
            // This is still an object, because the "cut here" strings have not
            // been appended.
            expect(loggingFn.getCall(0).args[0]).to.be.an('object')
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
  expect(nock.recorder.play()).to.be.empty()

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
            expect(recorded).to.have.lengthOf(1)
            expect(recorded[0]).to.be.an('object')
            expect(recorded[0].reqheaders).to.be.an('object')
            expect(recorded[0].reqheaders['user-agent']).to.be.undefined()
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
  expect(nock.recorder.play()).to.be.empty()

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
        const recorded = nock.recorder.play()
        expect(recorded).to.have.lengthOf(1)
        expect(recorded[0]).to.include({ path: '/?q=test%20search' })
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
  expect(nock.recorder.play()).to.be.empty()

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
        const recorded = nock.recorder.play()
        expect(recorded).to.have.lengthOf(1)
        expect(recorded[0]).to.include('test%20search%2B%2B')
        t.end()
      })
  })
})

test('works with clients listening for readable', t => {
  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()
  t.once('end', () => nock.restore())

  const requestBody = 'ABCDEF'
  const responseBody = '012345'

  const server = http.createServer((req, res) => {
    res.end(responseBody)
  })
  t.once('end', () => server.close())

  server.listen(() => {
    nock.recorder.rec({ dont_print: true, output_objects: true })

    const { port } = server.address()
    http
      .request(
        {
          host: 'localhost',
          port,
          path: '/',
        },
        res => {
          let readableCount = 0
          let chunkCount = 0

          res.on('readable', () => {
            ++readableCount
            let chunk
            while ((chunk = res.read()) !== null) {
              expect(chunk.toString()).to.equal(responseBody)
              ++chunkCount
            }
          })

          res.once('end', () => {
            expect(readableCount).to.equal(1)
            expect(chunkCount).to.equal(1)

            const recorded = nock.recorder.play()
            expect(recorded).to.have.lengthOf(1)
            expect(recorded[0])
              .to.be.an('object')
              .and.include({
                scope: `http://localhost:${port}`,
                method: 'GET',
                body: requestBody,
                status: 200,
                response: responseBody,
              })
            t.end()
          })
        }
      )
      .end(requestBody)
  })
})

test('outputs query string parameters using query()', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  server.listen(() => {
    nock.recorder.rec(true)

    superagent
      .get(`http://localhost:${server.address().port}/`)
      .query({ param1: 1, param2: 2 })
      .end((err, resp) => {
        expect(err).to.be.null()
        expect(resp).to.be.ok()
        expect(resp.headers).to.be.ok()

        const recorded = nock.recorder.play()
        expect(recorded).to.have.lengthOf(1)
        expect(recorded[0])
          .to.be.a('string')
          .and.include(`.query({"param1":"1","param2":"2"})`)
        t.end()
      })
  })
})

test('outputs query string arrays correctly', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()

  server.listen(() => {
    nock.recorder.rec(true)

    superagent
      .get(`http://localhost:${server.address().port}/`)
      .query({ foo: ['bar', 'baz'] })
      .end((err, resp) => {
        expect(err).to.be.null()
        expect(resp).to.be.ok()
        expect(resp.headers).to.be.ok()

        const recorded = nock.recorder.play()
        expect(recorded).to.have.lengthOf(1)
        expect(recorded[0])
          .to.be.a('string')
          .and.include(`.query({"foo":["bar","baz"]})`)
        t.end()
      })
  })
})

test('removes query params from the path and puts them in query()', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  t.once('end', () => server.close())

  nock.restore()
  nock.recorder.clear()
  expect(nock.recorder.play()).to.be.empty()
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
            expect(recorded).to.have.lengthOf(1)
            expect(recorded[0])
              .to.be.a('string')
              .and.include(`nock('http://localhost:${server.address().port}',`)
              .and.include(`.query({"param1":"1","param2":"2"})`)
            t.end()
          })
        }
      )
      .end('ABCDEF')
  })
})

test('respects http.request() consumers', t => {
  const server = http.createServer((req, res) => {
    res.write('foo')
    setTimeout(() => {
      res.end('bar')
    }, 25)
  })

  server.listen(() => {
    nock.restore()
    nock.recorder.clear()
    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const req = http.request(
      {
        host: 'localhost',
        port: server.address().port,
        path: '/',
      },
      res => {
        let buffer = Buffer.from('')

        setTimeout(() => {
          res
            .on('data', data => {
              buffer = Buffer.concat([buffer, data])
            })
            .on('end', () => {
              nock.restore()
              expect(buffer.toString()).to.equal('foobar')
              t.end()

              server.close()
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
  expect(nock.recorder.play()).to.be.empty()

  nock.recorder.rec({
    output_objects: true,
    dont_print: true,
  })

  const transparentGifHex =
    '47494638396101000100800000000000ffffff21f90401000000002c000000000100010000020144003b'
  const transparentGifBuffer = Buffer.from(transparentGifHex, 'hex')

  const server = http.createServer((request, response) => {
    response.writeHead(201, {
      'Content-Type': 'image/gif',
      'Content-Length': transparentGifBuffer.length,
    })
    response.write(transparentGifBuffer, 'binary')
    response.end()
  })

  server.listen(() => {
    const options = {
      method: 'PUT',
      host: 'localhost',
      port: server.address().port,
      path: '/clear.gif',
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': transparentGifBuffer.length,
      },
    }

    const postRequest1 = http.request(options, response => {
      const data = []

      response.on('data', chunk => {
        data.push(chunk)
      })

      response.on('end', () => {
        expect(Buffer.concat(data).toString('hex')).to.equal(transparentGifHex)

        const recordedFixtures = nock.recorder.play()

        server.close(error => {
          t.error(error)

          nock.restore()
          nock.activate()
          nock.define(recordedFixtures)

          // Send same post request again.
          const postRequest2 = http.request(options, response => {
            const data = []

            response.on('data', chunk => {
              data.push(chunk)
            })

            response.on('end', () => {
              expect(Buffer.concat(data).toString('hex')).to.equal(
                transparentGifHex
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
  expect(leaks).to.be.empty()
  t.end()
})
