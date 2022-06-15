'use strict'

// Tests of the RequestOverrider, which mocks http.ClientRequest and
// https.ClientRequest. The goal is to provide parity of behavior, both
// documented and undocumented, with the real version.
//
// While most of nock's tests are functional tests which invoke Nock's public
// API and make assertions about requests, usually with got, the tests of the
// request overrider tend to use http directly, and make lower-level
// assertions about how the mock client responds. Here the code under test is
// the part of Nock that must interface with all http clients.

const http = require('http')
const https = require('https')
const { URL } = require('url')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')
const FormData = require('form-data')

const got = require('./got_client')
const servers = require('./servers')

describe('Request Overrider', () => {
  it('response is an http.IncomingMessage instance', done => {
    const responseText = 'incoming message!'
    const scope = nock('http://example.test')
      .get('/somepath')
      .reply(200, responseText)

    http
      .request(
        {
          host: 'example.test',
          path: '/somepath',
        },
        res => {
          res.resume()
          expect(res).to.be.an.instanceof(http.IncomingMessage)
          scope.done()
          done()
        }
      )
      .end()
  })

  it('emits the response event', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.get('http://example.test')

    req.on('response', () => {
      scope.done()
      done()
    })
  })

  it('write callback called', done => {
    const scope = nock('http://example.test')
      .filteringRequestBody(/mia/, 'nostra')
      .post('/', 'mamma nostra')
      .reply()

    const reqWriteCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
        port: 80,
      },
      res => {
        expect(reqWriteCallback).to.have.been.calledOnce()
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.write('mamma mia', null, () => {
      reqWriteCallback()
      req.end()
    })
  })

  it('write callback called when encoding is not supplied', done => {
    const scope = nock('http://example.test')
      .filteringRequestBody(/mia/, 'nostra')
      .post('/', 'mamma nostra')
      .reply()

    const reqWriteCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
        port: 80,
      },
      res => {
        expect(reqWriteCallback).to.have.been.calledOnce()
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.write('mamma mia', () => {
      reqWriteCallback()
      req.end()
    })
  })

  it('write callback is not called if the provided chunk is undefined', done => {
    const scope = nock('http://example.test').post('/').reply()

    const reqWriteCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
      },
      res => {
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          expect(reqWriteCallback).to.not.have.been.called()
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.write(undefined, null, reqWriteCallback)
    req.end()
  })

  it("write doesn't throw if invoked w/o callback", done => {
    const scope = nock('http://example.test').post('/').reply()

    const reqWriteCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
      },
      res => {
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          expect(reqWriteCallback).to.not.have.been.called()
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.write(undefined)
    req.end()
  })

  it('end callback called', done => {
    const scope = nock('http://example.test')
      .filteringRequestBody(/mia/, 'nostra')
      .post('/', 'mamma nostra')
      .reply()

    const reqEndCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
        port: 80,
      },
      res => {
        expect(reqEndCallback).to.have.been.calledOnce()
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.end('mamma mia', null, reqEndCallback)
  })

  // https://github.com/nock/nock/issues/1509
  it('end callback called when end has callback, but no buffer', done => {
    const scope = nock('http://example.test').post('/').reply()

    const reqEndCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
        port: 80,
      },
      res => {
        expect(reqEndCallback).to.have.been.calledOnce()
        expect(res.statusCode).to.equal(200)
        res.on('end', () => {
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.end(reqEndCallback)
  })

  it('request.end called with all three arguments', done => {
    const scope = nock('http://example.test').post('/', 'foobar').reply()

    const reqEndCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
      },
      res => {
        expect(reqEndCallback).to.have.been.calledOnce()
        res.on('end', () => {
          scope.done()
          done()
        })
        res.resume()
      }
    )

    // hex(foobar) == 666F6F626172
    req.end('666F6F626172', 'hex', reqEndCallback)
  })

  it('request.end called with only data and encoding', done => {
    const scope = nock('http://example.test').post('/', 'foobar').reply()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
      },
      res => {
        res.on('end', () => {
          scope.done()
          done()
        })
        res.resume()
      }
    )

    // hex(foobar) == 666F6F626172
    req.end('666F6F626172', 'hex')
  })

  it('request.end called with only data and a callback', done => {
    const scope = nock('http://example.test').post('/', 'foobar').reply()

    const reqEndCallback = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
      },
      res => {
        expect(reqEndCallback).to.have.been.calledOnce()
        res.on('end', () => {
          scope.done()
          done()
        })
        res.resume()
      }
    )

    req.end('foobar', reqEndCallback)
  })

  // https://github.com/nock/nock/issues/2112
  it('request.end can be called multiple times without a chunk and not error', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request(
      {
        host: 'example.test',
        method: 'GET',
        path: '/',
      },
      res => {
        res.on('end', () => {
          scope.done()
          done()
        })
        res.resume()
      }
    )

    req.end()
    req.end()
    req.end()
  })

  it('should emit an error if `write` is called after `end`', done => {
    nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')

    req.on('error', err => {
      expect(err.message).to.equal('write after end')
      expect(err.code).to.equal('ERR_STREAM_WRITE_AFTER_END')
      done()
    })

    req.end()
    req.write('foo')
  })

  // http://github.com/nock/nock/issues/139
  it('should emit "finish" on the request before emitting "end" on the response', done => {
    const scope = nock('http://example.test').post('/').reply()

    const onFinish = sinon.spy()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
        port: 80,
      },
      res => {
        expect(onFinish).to.have.been.calledOnce()
        expect(res.statusCode).to.equal(200)

        res.on('end', () => {
          expect(onFinish).to.have.been.calledOnce()
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.on('finish', onFinish)

    req.end('mamma mia')
  })

  it('should update the writable attributes before emitting the "finish" event', done => {
    nock('http://example.test').post('/').reply()

    const req = http.request({
      host: 'example.test',
      method: 'POST',
      path: '/',
      port: 80,
    })

    // `writableEnded` was added in v12.9.0 to rename `finished` which was deprecated in v13.4.0. it's just an alias,
    // but it only denotes that `end` was called on the request not that the socket has finished flushing (hence the rename).
    expect(req.finished).to.be.false()
    const hasWriteable = 'writableEnded' in req // to support v10
    expect(req.writableEnded).to.equal(hasWriteable ? false : undefined)

    // `writableFinished` denotes all data has been flushed to the underlying system, immediately before
    // the 'finish' event is emitted. Nock's "socket" is instantaneous so these attributes never differ.
    expect(req.writableFinished).to.equal(hasWriteable ? false : undefined)

    req.on('finish', () => {
      expect(req.finished).to.be.true()
      expect(req.writableEnded).to.equal(hasWriteable ? true : undefined)
      expect(req.writableFinished).to.equal(hasWriteable ? true : undefined)

      done()
    })

    req.end('mamma mia')
  })

  // TODO Convert to async / got.
  it('pause response before data', done => {
    const scope = nock('http://example.test')
      .get('/pauser')
      .reply(200, 'nobody')

    const req = http.request({
      host: 'example.test',
      path: '/pauser',
    })

    const didTimeout = sinon.spy()
    const onData = sinon.spy()

    req.on('response', res => {
      res.pause()

      setTimeout(() => {
        didTimeout()
        res.resume()
      }, 500)

      res.on('data', () => {
        onData()
        expect(didTimeout).to.have.been.calledOnce()
      })

      res.on('end', () => {
        expect(onData).to.have.been.calledOnce()
        scope.done()
        done()
      })
    })

    req.end()
  })

  it('accept URL as request target', done => {
    const onData = sinon.spy()

    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    http.get(new URL('http://example.test'), res => {
      expect(res.statusCode).to.equal(200)

      res.on('data', data => {
        onData()
        expect(data).to.be.an.instanceof(Buffer)
        expect(data.toString()).to.equal('Hello World!')
      })

      res.on('end', () => {
        expect(onData).to.have.been.calledOnce()
        scope.done()
        done()
      })
    })
  })

  it('request has path', done => {
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
      res => {
        scope.done()
        expect(req.path).to.equal('/the/path/to/infinity')
        done()
      }
    )
    req.end()
  })

  it('has a req property on the response', done => {
    const scope = nock('http://example.test').get('/like-wtf').reply(200)

    const req = http.request('http://example.test/like-wtf', res => {
      res.on('end', () => {
        expect(res.req).to.be.an.instanceof(http.ClientRequest)
        scope.done()
        done()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    })
    req.end()
  })

  // Hopefully address https://github.com/nock/nock/issues/146, at least in spirit.
  it('request with a large buffer', async () => {
    const replyLength = 1024 * 1024
    const responseBody = Buffer.from(new Array(replyLength + 1).join('.'))
    // Confidence check.
    expect(responseBody.length).to.equal(replyLength)

    const scope = nock('http://example.test')
      .get('/')
      .reply(200, responseBody, { 'Content-Encoding': 'gzip' })

    const { body } = await got('http://example.test', {
      responseType: 'buffer',
      decompress: false,
    })
    expect(body).to.deep.equal(responseBody)
    scope.done()
  })

  it('.setNoDelay', done => {
    nock('http://example.test').get('/yay').reply(200, 'Hi')

    const req = http.request(
      {
        host: 'example.test',
        path: '/yay',
        port: 80,
      },
      res => {
        expect(res.statusCode).to.equal(200)
        res.on('end', done)
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )

    req.setNoDelay(true)

    req.end()
  })

  it('request emits socket', done => {
    nock('http://example.test').get('/').reply(200, 'hey')

    const req = http.get('http://example.test')
    // Using `this`, so can't use arrow function.
    req.once('socket', function (socket) {
      // https://github.com/nock/nock/pull/769
      // https://github.com/nock/nock/pull/779
      expect(this).to.equal(req)
      expect(socket).to.be.an.instanceof(Object)
      done()
    })
  })

  it('socket is shared and aliased correctly', done => {
    nock('http://example.test').get('/').reply()

    const req = http.get('http://example.test')

    req.once('response', res => {
      expect(req.socket).to.equal(req.connection)
      expect(req.socket).to.equal(res.socket)
      expect(res.socket).to.equal(res.client)
      expect(res.socket).to.equal(res.connection)
      done()
    })
  })

  it('socket emits connect and secureConnect', done => {
    nock('https://example.test').post('/').reply(200, 'hey')

    const req = https.request({
      host: 'example.test',
      path: '/',
      method: 'POST',
    })

    const onConnect = sinon.spy()
    const onSecureConnect = sinon.spy()

    req.on('socket', socket => {
      socket.once('connect', () => {
        onConnect()
        req.end()
      })
      socket.once('secureConnect', onSecureConnect)
    })

    req.once('response', res => {
      res.setEncoding('utf8')
      res.on('data', data => {
        expect(data).to.equal('hey')
        expect(onConnect).to.have.been.calledOnce()
        expect(onSecureConnect).to.have.been.calledOnce()
        done()
      })
    })
  })

  it('socket has address() method', done => {
    nock('http://example.test').get('/').reply()

    const req = http.get('http://example.test')
    req.once('socket', socket => {
      expect(socket.address()).to.deep.equal({
        port: 80,
        family: 'IPv4',
        address: '127.0.0.1',
      })
      done()
    })
  })

  it('socket has address() method, https/IPv6', done => {
    nock('https://example.test').get('/').reply()

    const req = https.get('https://example.test', { family: 6 })
    req.once('socket', socket => {
      expect(socket.address()).to.deep.equal({
        port: 443,
        family: 'IPv6',
        address: '::1',
      })
      done()
    })
  })

  it('socket has setKeepAlive() method', done => {
    nock('http://example.test').get('/').reply(200, 'hey')

    const req = http.get('http://example.test')
    req.once('socket', socket => {
      socket.setKeepAlive(true)
      done()
    })
  })

  it('socket has ref() and unref() method', done => {
    nock('http://example.test').get('/').reply(200, 'hey')

    const req = http.get('http://example.test')
    req.once('socket', socket => {
      expect(socket).to.respondTo('ref').and.to.to.respondTo('unref')
      // FIXME: These functions, and many of the other Socket functions, should
      // actually return `this`.
      // https://github.com/nock/nock/pull/1770#discussion_r343425097
      expect(socket.ref()).to.be.undefined()
      expect(socket.unref()).to.be.undefined()
      done()
    })
  })

  it('socket has destroy() method', done => {
    nock('http://example.test').get('/').reply(200, 'hey')

    const req = http.get('http://example.test')
    req.on('error', () => {}) // listen for error so it doesn't bubble
    req.once('socket', socket => {
      socket.destroy()
      done()
    })
  })

  it('calling Socket#destroy() multiple times only emits a single `close` event', done => {
    nock('http://example.test').get('/').reply(200, 'hey')

    const req = http.get('http://example.test')
    req.on('error', () => {}) // listen for error so it doesn't bubble
    req.once('socket', socket => {
      const closeSpy = sinon.spy()
      socket.on('close', closeSpy)

      socket.destroy().destroy().destroy()

      setTimeout(() => {
        expect(closeSpy).to.have.been.calledOnce()
        done()
      }, 10)
    })
  })

  it('socket has getPeerCertificate() method which returns a random base64 string', done => {
    nock('http://example.test').get('/').reply()

    const req = http.get('http://example.test')
    req.once('socket', socket => {
      const first = socket.getPeerCertificate()
      const second = socket.getPeerCertificate()
      expect(first).to.be.a('string')
      expect(second).to.be.a('string').and.not.equal(first)
      done()
    })
  })

  it('abort destroys socket', done => {
    nock('http://example.test').get('/').reply(200, 'hey')

    const req = http.get('http://example.test')
    // Ignore errors.
    req.once('error', () => {})
    req.once('socket', socket => {
      req.abort()
      expect(socket.destroyed).to.be.true()
      done()
    })
  })

  it('should throw expected error when creating request with missing options', done => {
    expect(() => http.request()).to.throw(
      Error,
      'Making a request with empty `options` is not supported in Nock'
    )
    done()
  })

  // https://github.com/nock/nock/issues/1558
  it("mocked requests have 'method' property", done => {
    const scope = nock('http://example.test').get('/somepath').reply(200, {})

    const req = http.request({
      host: 'example.test',
      path: '/somepath',
      method: 'GET',
      port: 80,
    })

    expect(req.method).to.equal('GET')

    req.on('response', res => {
      expect(res.req.method).to.equal('GET')
      scope.done()
      done()
    })

    req.end()
  })

  // https://github.com/nock/nock/issues/1493
  it("response has 'complete' property and it's true after end", done => {
    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello World!')

    const req = http.request(
      {
        host: 'example.test',
        method: 'GET',
        path: '/',
        port: 80,
      },
      res => {
        res.on('end', () => {
          expect(res.complete).to.be.true()
          scope.done()
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )
    req.end()
  })

  it('Request with `Expect: 100-continue` triggers continue event', done => {
    // This is a replacement for a wide-bracket regression test that was added
    // for https://github.com/nock/nock/issues/256.
    //
    // The behavior was subsequently changed so 'continue' is emitted only when
    // the `Expect: 100-continue` header is present.
    //
    // This test was adapted from this test from Node:
    // https://github.com/nodejs/node/blob/1b2d3f7ae7f0391908b70b0333a5adef3c8cb79d/test/parallel/test-http-expect-continue.js#L35
    //
    // Related:
    // https://tools.ietf.org/html/rfc2616#section-8.2.3
    // https://github.com/nodejs/node/issues/10487
    const exampleRequestBody = 'this is the full request body'

    const scope = nock('http://example.test')
      .post('/', exampleRequestBody)
      .reply()

    const req = http.request({
      host: 'example.test',
      method: 'POST',
      path: '/',
      port: 80,
      headers: { Expect: '100-continue' },
    })

    const onData = sinon.spy()

    req.on('response', res => {
      expect(res.statusCode).to.equal(200)
      // The `end` event will not fire without a `data` listener, though it
      // will never fire since the body is empty. This is consistent with
      // the Node docs:
      // https://nodejs.org/api/http.html#http_class_http_clientrequest
      res.on('data', onData)
      res.on('end', () => {
        expect(onData).not.to.have.been.called()
        scope.done()
        done()
      })
    })

    req.on('continue', () => {
      req.end(exampleRequestBody)
    })
  })

  // https://github.com/nock/nock/issues/1836
  it('when http.get and http.request have been overridden before nock overrides them, http.get calls through to the expected method', async () => {
    // Obtain the original `http.request()` and stub it out, as a library might.
    nock.restore()
    const overriddenRequest = sinon.stub(http, 'request').callThrough()
    const overriddenGet = sinon.stub(http, 'get').callThrough()

    // Let Nock override them again.
    nock.activate()

    const { origin } = await servers.startHttpServer((request, response) => {
      response.writeHead(200)
      response.end()
    })

    const req = http.get(origin)
    expect(overriddenGet).to.have.been.calledOnce()
    expect(overriddenRequest).not.to.have.been.called()

    req.abort()
  })

  // https://github.com/nock/nock/issues/1836
  it('when http.get and http.request have been overridden before nock overrides them, http.request calls through to the expected method', async () => {
    // Obtain the original `http.request()` and stub it out, as a library might.
    nock.restore()
    const overriddenRequest = sinon.stub(http, 'request').callThrough()
    const overriddenGet = sinon.stub(http, 'get').callThrough()

    // Let Nock override them again.
    nock.activate()

    const req = http.request({
      host: 'localhost',
      path: '/',
      port: 1234,
    })
    expect(overriddenRequest).to.have.been.calledOnce()
    expect(overriddenGet).not.to.have.been.called()

    req.abort()
  })

  // https://github.com/nock/nock/issues/2231
  it('mocking a request which sends an empty buffer should finalize', async () => {
    const prefixUrl = 'http://www.test.com'
    const bufferEndpoint = 'upload/buffer/'

    nock(prefixUrl).post(`/${bufferEndpoint}`).reply(200, 'BUFFER_SENT')

    const formData = new FormData()

    formData.append('fileData', Buffer.alloc(0), 'chunk')

    const options = {
      prefixUrl,
      body: formData,
    }

    const { body: response } = await got.post(bufferEndpoint, options)

    expect(response).to.equal('BUFFER_SENT')
  })

  // https://github.com/nock/nock/issues/2298
  it('should handle non-default agents', async () => {
    nock('https://example.test').get('/').reply(200, 'OK')

    const agent = {
      foo: 'bar',
    }

    const { statusCode } = await got('https://example.test', {
      agent: { https: agent },
    })
    expect(statusCode).to.equal(200)
  })
})
