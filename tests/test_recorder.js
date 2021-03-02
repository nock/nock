'use strict'

const http = require('http')
const https = require('https')
const { URLSearchParams } = require('url')
const zlib = require('zlib')
const sinon = require('sinon')
const { expect } = require('chai')
const nock = require('..')

const got = require('./got_client')
const servers = require('./servers')

describe('Recorder', () => {
  let globalCount
  beforeEach(() => {
    globalCount = Object.keys(global).length
  })
  afterEach(() => {
    let leaks = Object.keys(global).splice(globalCount, Number.MAX_VALUE)
    if (leaks.length === 1 && leaks[0] === '_key') {
      leaks = []
    }
    expect(leaks).to.be.empty()
  })

  it('does not record requests from previous sessions', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    nock.recorder.rec(true)

    const req1 = http.get(`${origin}/foo`)
    const req1Promise = new Promise(resolve => {
      req1.on('response', res => {
        res.on('end', resolve)
        res.resume()
      })
    })

    // start a new recording session while the first request is still in flight
    nock.restore()
    nock.recorder.rec(true)
    await got.post(`${origin}/bar`)

    // wait for the first request to end
    await req1Promise

    // validate only the request from the second session is in the outputs
    const outputs = nock.recorder.play()
    expect(outputs).to.have.lengthOf(1)
    expect(outputs[0]).to.match(/\.post\('\/bar'\)/)
  })

  it('when request port is different, use the alternate port', async () => {
    nock.restore()
    nock.recorder.clear()
    nock.recorder.rec(true)

    const { origin, port } = await servers.startHttpServer()

    expect(port).not.to.equal(80)

    await got.post(origin)

    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0]).to.include(`nock('http://localhost:${port}',`)
  })

  it('recording turns off nock interception (backward compatibility behavior)', () => {
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
  })

  it('records', async () => {
    const gotRequest = sinon.spy()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    const { origin, port } = await servers.startHttpServer(
      (request, response) => {
        gotRequest()
        response.writeHead(200)
        response.end()
      }
    )

    nock.recorder.rec(true)

    await got.post(origin)

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

  it('records objects', async () => {
    const gotRequest = sinon.spy()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    const { origin } = await servers.startHttpServer((request, response) => {
      gotRequest()
      response.writeHead(200)
      response.end()
    })

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const requestBody = '0123455'
    await got.post(origin, { body: requestBody })

    expect(gotRequest).to.have.been.calledOnce()
    nock.restore()
    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0]).to.include({
      scope: origin,
      method: 'POST',
      body: requestBody,
    })
  })

  it('logs recorded objects', async () => {
    const gotRequest = sinon.spy()
    const loggingFn = sinon.spy()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    const { origin } = await servers.startHttpServer((request, response) => {
      gotRequest()
      response.writeHead(200)
      response.end()
    })

    nock.recorder.rec({
      logging: loggingFn,
      output_objects: true,
    })

    await got.post(origin)

    expect(gotRequest).to.have.been.calledOnce()
    expect(loggingFn).to.have.been.calledOnce()
    expect(
      loggingFn
        .getCall(0)
        .args[0].startsWith(
          '\n<<<<<<-- cut here -->>>>>>\n{\n  "scope": "http://localhost:'
        )
    ).to.be.true()
  })

  it('records objects and correctly stores JSON object in body', async () => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    const { origin } = await servers.startHttpServer()

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const exampleBody = { foo: 123 }

    await got.post(origin, {
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

  it('records and replays objects correctly', async () => {
    const exampleText = '<html><body>example</body></html>'

    const { origin } = await servers.startHttpServer((request, response) => {
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

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const response1 = await got(origin)
    expect(response1.body).to.equal(exampleText)

    nock.restore()
    const recorded = nock.recorder.play()
    nock.recorder.clear()
    nock.activate()

    expect(recorded).to.have.lengthOf(2)
    const nocks = nock.define(recorded)

    const response2 = await got(origin)
    expect(response2.body).to.equal(exampleText)
    nocks.forEach(nock => nock.done())
  })

  it('records and replays correctly with filteringRequestBody', async () => {
    const responseBody = '<html><body>example</body></html>'
    const { origin } = await servers.startHttpServer((request, response) => {
      response.write(responseBody)
      response.end()
    })

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const response1 = await got(origin)
    expect(response1.body).to.equal(responseBody)
    expect(response1.headers).to.be.ok()

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

    const response2 = await got(origin)
    expect(response2.body).to.equal(responseBody)
    nocks.forEach(nock => nock.done())
    expect(onFilteringRequestBody).to.have.been.calledOnce()
  })

  // https://github.com/nock/nock/issues/29
  it('http request without callback should not crash', done => {
    const serverFinished = sinon.spy()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
      nock.recorder.rec(true)
      const req = http.request({
        host: 'localhost',
        port,
        method: 'GET',
        path: '/',
      })

      req.on('response', res => {
        res.once('end', () => {
          expect(serverFinished).to.have.been.calledOnce()
          done()
        })
        res.resume()
      })

      req.end()
      serverFinished()
    })
  })

  it('checks that data is specified', () => {
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
  })

  it('when request body is json, it goes unstringified', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    nock.recorder.rec(true)

    const payload = { a: 1, b: true }

    await got.post(origin, { body: JSON.stringify(payload) })

    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0]).to.include('.post(\'/\', {"a":1,"b":true})')
  })

  it('when request body is json, it goes unstringified in objects', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    nock.recorder.rec({ dont_print: true, output_objects: true })

    const payload = { a: 1, b: true }

    await got.post(origin, { body: JSON.stringify(payload) })

    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0]).to.be.an('object')
    expect(recorded[0].body).to.be.an('object').and.deep.equal(payload)
  })

  it('records nonstandard ports', done => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    const requestBody = 'ABCDEF'
    const responseBody = '012345'

    const requestListener = (req, res) => {
      res.end(responseBody)
    }

    servers.startHttpServer(requestListener).then(({ origin, port }) => {
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
      })

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
            expect(recorded[0]).to.be.an('object').and.include({
              scope: origin,
              method: 'GET',
              body: requestBody,
              status: 200,
              response: responseBody,
            })
            done()
          })
        }
      )

      req.end(requestBody)
    })
  })

  it('`req.end()` accepts and calls a callback when recording', done => {
    const onEnd = sinon.spy()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
      nock.recorder.rec({ dont_print: true })

      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/',
          method: 'GET',
        },
        res => {
          expect(onEnd).to.have.been.calledOnce()
          expect(res.statusCode).to.equal(200)
          res.on('end', () => {
            done()
          })
          res.resume()
        }
      )

      req.end(onEnd)
    })
  })

  // https://nodejs.org/api/http.html#http_request_end_data_encoding_callback
  it('when recording, when `req.end()` is called with only data and a callback, the callback is invoked and the data is sent', done => {
    const onEnd = sinon.spy()

    let requestBody = ''
    const requestListener = (request, response) => {
      request.on('data', data => {
        requestBody += data
      })
      request.on('end', () => {
        response.writeHead(200)
        response.end()
      })
    }

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer(requestListener).then(({ port }) => {
      nock.recorder.rec({ dont_print: true })

      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/',
          method: 'POST',
        },
        res => {
          expect(onEnd).to.have.been.calledOnce()
          expect(res.statusCode).to.equal(200)

          res.on('end', () => {
            expect(requestBody).to.equal('foobar')
            done()
          })
          res.resume()
        }
      )

      req.end('foobar', onEnd)
    })
  })

  it('`rec()` throws when reinvoked with already recorder requests', () => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec()
    expect(() => nock.recorder.rec()).to.throw(
      Error,
      'Nock recording already in progress'
    )
  })

  it('records https correctly', done => {
    const requestBody = '012345'
    const responseBody = '<html><body>example</body></html>'

    const requestListener = (request, response) => {
      response.write(responseBody)
      response.end()
    }

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    servers.startHttpsServer(requestListener).then(({ origin, port }) => {
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
              expect(recorded[0]).to.be.an('object').and.to.include({
                scope: origin,
                method: 'POST',
                body: requestBody,
                status: 200,
                response: responseBody,
              })
              done()
            })
          }
        )
        .end(requestBody)
    })
  })

  it('records request headers correctly as an object', done => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
        enable_reqheaders_recording: true,
      })

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
              done()
            })
          }
        )
        .end()
    })
  })

  it('records request headers correctly when not outputting objects', async () => {
    const gotRequest = sinon.spy()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    const { origin } = await servers.startHttpServer((request, response) => {
      gotRequest()
      response.writeHead(200)
      response.end()
    })

    nock.recorder.rec({
      dont_print: true,
      enable_reqheaders_recording: true,
    })

    await got.post(origin, { headers: { 'X-Foo': 'bar' } })
    expect(gotRequest).to.have.been.calledOnce()

    nock.restore()

    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0])
      .to.be.a('string')
      .and.include('  .matchHeader("x-foo", "bar")')
  })

  it('records and replays gzipped nocks correctly', async () => {
    const exampleText = '<html><body>example</body></html>'

    const { origin } = await servers.startHttpServer((request, response) => {
      zlib.gzip(exampleText, (err, result) => {
        expect(err).to.be.null()
        response.writeHead(200, { 'content-encoding': 'gzip' })
        response.end(result)
      })
    })

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const response1 = await got(origin)
    expect(response1.body).to.equal(exampleText)
    expect(response1.headers).to.include({ 'content-encoding': 'gzip' })

    nock.restore()
    const recorded = nock.recorder.play()
    nock.recorder.clear()
    nock.activate()

    expect(recorded).to.have.lengthOf(1)
    const nocks = nock.define(recorded)

    const response2 = await got(origin)
    expect(response2.body).to.equal(exampleText)
    expect(response2.headers).to.include({ 'content-encoding': 'gzip' })

    nocks.forEach(nock => nock.done())
  })

  it('records and replays the response body', async () => {
    const exampleBody = '<html><body>example</body></html>'

    const { origin } = await servers.startHttpServer((request, response) => {
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

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    const response1 = await got(origin)
    expect(response1.body).to.equal(exampleBody)

    nock.restore()
    const recorded = nock.recorder.play()
    nock.recorder.clear()
    nock.activate()

    // Two requests, on account of the redirect.
    expect(recorded).to.have.lengthOf(2)
    const nocks = nock.define(recorded)

    const response2 = await got(origin)
    expect(response2.body).to.equal(exampleBody)
    nocks.forEach(nock => nock.done())
  })

  it('when encoding is set during recording, body is still recorded correctly', done => {
    const responseBody = '<html><body>example</body></html>'

    const requestListener = (request, response) => {
      response.write(responseBody)
      response.end()
    }

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer(requestListener).then(({ port }) => {
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
      })

      const req = http.request(
        { host: 'localhost', port, path: '/', method: 'POST' },
        res => {
          res.setEncoding('hex')

          const hexChunks = []
          res.on('data', data => {
            hexChunks.push(data)
          })

          res.on('end', () => {
            nock.restore()
            const recorded = nock.recorder.play()
            nock.recorder.clear()
            nock.activate()

            // Confidence check: we're getting hex.
            expect(hexChunks.join('')).to.equal(
              Buffer.from(responseBody, 'utf8').toString('hex')
            )

            // Assert: we're recording utf-8.
            expect(recorded).to.have.lengthOf(1)
            expect(recorded[0]).to.include({ response: responseBody })

            done()
          })
        }
      )
      req.end()
    })
  })

  it("doesn't record request headers by default", done => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
      })

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
              expect(recorded[0]).to.be.an('object')
              expect(recorded[0].reqheaders).to.be.undefined()
              done()
            })
          }
        )
        .end()
    })
  })

  it('will call a custom logging function', done => {
    // This also tests that use_separator is on by default.
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
      const loggingFn = sinon.spy()
      nock.recorder.rec({ logging: loggingFn })

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

              expect(loggingFn).to.have.been.calledOnce()
              expect(loggingFn.getCall(0).args[0]).to.be.a('string')
              done()
            })
          }
        )
        .end()
    })
  })

  it('use_separator:false is respected', done => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
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
            port,
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
              done()
            })
          }
        )
        .end()
    })
  })

  it('records request headers except user-agent if enable_reqheaders_recording is set to true', done => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
        enable_reqheaders_recording: true,
      })

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
              expect(recorded[0]).to.be.an('object')
              expect(recorded[0].reqheaders).to.be.an('object')
              expect(recorded[0].reqheaders['user-agent']).to.be.undefined()
              done()
            })
          }
        )
        .end()
    })
  })

  it('records query parameters', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec({
      dont_print: true,
      output_objects: true,
    })

    await got(origin, {
      searchParams: { q: 'test search' },
    })

    nock.restore()
    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0]).to.include({ path: '/?q=test+search' })
  })

  it('encodes the query parameters when not outputting objects', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec({
      dont_print: true,
      output_objects: false,
    })

    await got(origin, {
      searchParams: { q: 'test search++' },
    })

    nock.restore()
    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0]).to.include('test%20search%2B%2B')
  })

  // https://github.com/nock/nock/issues/193
  it('works with clients listening for readable', done => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    const requestBody = 'ABCDEF'
    const responseBody = '012345'

    const requestListener = (req, res) => {
      res.end(responseBody)
    }

    servers.startHttpServer(requestListener).then(({ origin, port }) => {
      nock.recorder.rec({ dont_print: true, output_objects: true })

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
              expect(recorded[0]).to.be.an('object').and.include({
                scope: origin,
                method: 'GET',
                body: requestBody,
                status: 200,
                response: responseBody,
              })
              done()
            })
          }
        )
        .end(requestBody)
    })
  })

  it('outputs query string parameters using query()', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec(true)

    await got(origin, {
      searchParams: { param1: 1, param2: 2 },
    })

    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0])
      .to.be.a('string')
      .and.include(`.query({"param1":"1","param2":"2"})`)
  })

  it('outputs query string arrays correctly', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec(true)

    await got(origin, {
      searchParams: new URLSearchParams([
        ['foo', 'bar'],
        ['foo', 'baz'],
      ]),
    })

    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0])
      .to.be.a('string')
      .and.include(`.query({"foo":["bar","baz"]})`)
  })

  it('removes query params from the path and puts them in query()', done => {
    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    servers.startHttpServer().then(({ port }) => {
      nock.recorder.rec(true)
      http
        .request(
          {
            method: 'POST',
            host: 'localhost',
            port,
            path: '/?param1=1&param2=2',
          },
          res => {
            res.resume()
            res.once('end', () => {
              const recorded = nock.recorder.play()
              expect(recorded).to.have.lengthOf(1)
              expect(recorded[0])
                .to.be.a('string')
                .and.include(`nock('http://localhost:${port}',`)
                .and.include(`.query({"param1":"1","param2":"2"})`)
              done()
            })
          }
        )
        .end('ABCDEF')
    })
  })

  // https://github.com/nock/nock/issues/2136
  it('escapes single quotes in the path', async () => {
    const { origin } = await servers.startHttpServer()

    nock.restore()
    nock.recorder.clear()
    expect(nock.recorder.play()).to.be.empty()

    nock.recorder.rec(true)

    await got(`${origin}/foo'bar'baz`)

    const recorded = nock.recorder.play()
    expect(recorded).to.have.lengthOf(1)
    expect(recorded[0])
      .to.be.a('string')
      .and.include(`.get('/foo\\'bar\\'baz')`)
  })

  it('respects http.request() consumers', done => {
    const requestListener = (req, res) => {
      res.write('foo')
      setTimeout(() => {
        res.end('bar')
      }, 25)
    }

    servers.startHttpServer(requestListener).then(({ port }) => {
      nock.restore()
      nock.recorder.clear()
      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
      })

      const req = http.request(
        {
          host: 'localhost',
          port,
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
                done()
              })
          })
        },
        50
      )

      req.end()
    })
  })

  it('records and replays binary response correctly', done => {
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

    const requestListener = (request, response) => {
      response.writeHead(201, {
        'Content-Type': 'image/gif',
        'Content-Length': transparentGifBuffer.length,
      })
      response.write(transparentGifBuffer, 'binary')
      response.end()
    }

    servers.startHttpServer(requestListener).then(server => {
      const options = {
        method: 'PUT',
        host: 'localhost',
        port: server.port,
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
          expect(Buffer.concat(data).toString('hex')).to.equal(
            transparentGifHex
          )

          const recordedFixtures = nock.recorder.play()

          server.close(error => {
            server = undefined
            expect(error).to.be.undefined()

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
                done()
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

  // https://github.com/nock/nock/issues/2086
  it('should not resume the response stream', done => {
    nock.recorder.rec(true)

    servers.startHttpServer().then(({ origin }) => {
      const req = http.request(origin)

      req.on('response', res => {
        // wait for an iteration of the event loop to prove that the `end`
        // listener is being added after a delay. We want to show that callers
        // have time to register listeners before they manually call `resume`.
        setImmediate(() => {
          res.on('end', () => done())
          res.resume()
        })
      })

      req.end()
    })
  })
})
