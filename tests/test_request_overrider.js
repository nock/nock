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
const { test } = require('tap')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

require('./setup')

test('response is an http.IncomingMessage instance', t => {
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
        t.end()
      }
    )
    .end()
})

test('emits the response event', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const req = http.get('http://example.test')

  scope.done()

  req.on('response', () => {
    t.end()
  })
})

test('write callback called', t => {
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
        t.end()
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

test('end callback called', t => {
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
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.end('mamma mia', null, reqEndCallback)
})

// https://github.com/nock/nock/issues/1509
test('end callback called when end has callback, but no buffer', t => {
  const scope = nock('http://example.test')
    .post('/')
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
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.end(reqEndCallback)
})

test('request.end called with all three arguments', t => {
  const scope = nock('http://example.test')
    .post('/', 'foobar')
    .reply()

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
        t.end()
      })
      res.resume()
    }
  )

  // hex(foobar) == 666F6F626172
  req.end('666F6F626172', 'hex', reqEndCallback)
})

test('request.end called with only data and encoding', t => {
  const scope = nock('http://example.test')
    .post('/', 'foobar')
    .reply()

  const req = http.request(
    {
      host: 'example.test',
      method: 'POST',
      path: '/',
    },
    res => {
      res.on('end', () => {
        scope.done()
        t.end()
      })
      res.resume()
    }
  )

  // hex(foobar) == 666F6F626172
  req.end('666F6F626172', 'hex')
})

test('request.end called with only data and a callback', t => {
  const scope = nock('http://example.test')
    .post('/', 'foobar')
    .reply()

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
        t.end()
      })
      res.resume()
    }
  )

  req.end('foobar', reqEndCallback)
})

// http://github.com/nock/nock/issues/139
test('finish event fired before end event', t => {
  const scope = nock('http://example.test')
    .filteringRequestBody(/mia/, 'nostra')
    .post('/', 'mamma nostra')
    .reply()

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
        scope.done()
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.on('finish', onFinish)

  req.end('mamma mia')
})

// TODO Convert to async / got.
test('pause response before data', t => {
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
      t.end()
    })
  })

  req.end()
})

test('accept URL as request target', t => {
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
      t.end()
    })
  })
})

test('request has path', t => {
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
      t.end()
    }
  )
  req.end()
})

test('has a req property on the response', t => {
  const scope = nock('http://example.test')
    .get('/like-wtf')
    .reply(200)

  const req = http.request('http://example.test/like-wtf', res => {
    res.on('end', () => {
      expect(res.req).to.be.an.instanceof(http.ClientRequest)
      scope.done()
      t.end()
    })
    // Streams start in 'paused' mode and must be started.
    // See https://nodejs.org/api/stream.html#stream_class_stream_readable
    res.resume()
  })
  req.end()
})

// Hopefully address https://github.com/nock/nock/issues/146, at least in
// spirit.
test('request with a large buffer', async t => {
  const replyLength = 1024 * 1024
  const responseBody = Buffer.from(new Array(replyLength + 1).join('.'))
  // Confidence check.
  expect(responseBody.length).to.equal(replyLength)

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, responseBody, { 'Content-Encoding': 'gzip' })

  const { body } = await got('http://example.test', { decompress: false })
  expect(body).to.deep.equal(responseBody)
  scope.done()
})

test('.setNoDelay', t => {
  nock('http://example.test')
    .get('/yay')
    .reply(200, 'Hi')

  const req = http.request(
    {
      host: 'example.test',
      path: '/yay',
      port: 80,
    },
    res => {
      expect(res.statusCode).to.equal(200)
      res.on('end', () => t.end())
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )

  req.setNoDelay(true)

  req.end()
})

test('request emits socket', t => {
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
  // Using `this`, so can't use arrow function.
  req.once('socket', function(socket) {
    // https://github.com/nock/nock/pull/769
    // https://github.com/nock/nock/pull/779
    expect(this).to.equal(req)
    expect(socket).to.be.an.instanceof(Object)
    t.end()
  })
})

test('socket is shared and aliased correctly', t => {
  nock('http://example.test')
    .get('/')
    .reply()

  const req = http.get('http://example.test')

  req.once('response', res => {
    expect(req.socket).to.equal(req.connection)
    expect(req.socket).to.equal(res.socket)
    expect(res.socket).to.equal(res.client)
    expect(res.socket).to.equal(res.connection)
    t.end()
  })
})

test('socket emits connect and secureConnect', t => {
  nock('https://example.test')
    .post('/')
    .reply(200, 'hey')

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
      t.end()
    })
  })
})

test('socket has address() method', t => {
  nock('http://example.test')
    .get('/')
    .reply()

  const req = http.get('http://example.test')
  req.once('socket', socket => {
    expect(socket.address()).to.deep.equal({
      port: 80,
      family: 'IPv4',
      address: '127.0.0.1',
    })
    t.end()
  })
})

test('socket has address() method, https/IPv6', t => {
  nock('https://example.test')
    .get('/')
    .reply()

  const req = https.get('https://example.test', { family: 6 })
  req.once('socket', socket => {
    expect(socket.address()).to.deep.equal({
      port: 443,
      family: 'IPv6',
      address: '::1',
    })
    t.end()
  })
})

test('socket has setKeepAlive() method', t => {
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
  req.once('socket', socket => {
    socket.setKeepAlive(true)
    t.end()
  })
})

test('socket has ref() and unref() method', t => {
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
  req.once('socket', socket => {
    expect(socket)
      .to.respondTo('ref')
      .and.to.to.respondTo('unref')
    // FIXME: These functions, and many of the other Socket functions, should
    // actually return `this`.
    // https://github.com/nock/nock/pull/1770#discussion_r343425097
    expect(socket.ref()).to.be.undefined()
    expect(socket.unref()).to.be.undefined()
    t.end()
  })
})

test('socket has destroy() method', t => {
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
  req.once('socket', socket => {
    socket.destroy()
    t.end()
  })
})

test('socket has getPeerCertificate() method which returns a random base64 string', t => {
  nock('http://example.test')
    .get('/')
    .reply()

  const req = http.get('http://example.test')
  req.once('socket', socket => {
    const first = socket.getPeerCertificate()
    const second = socket.getPeerCertificate()
    expect(first).to.be.a('string')
    expect(second)
      .to.be.a('string')
      .and.not.equal(first)
    t.end()
  })
})

test('abort destroys socket', t => {
  nock('http://example.test')
    .get('/')
    .reply(200, 'hey')

  const req = http.get('http://example.test')
  // Ignore errors.
  req.once('error', () => {})
  req.once('socket', socket => {
    req.abort()
    expect(socket.destroyed).to.be.true()
    t.end()
  })
})

test('should throw expected error when creating request with missing options', t => {
  expect(() => http.request()).to.throw(
    Error,
    'Making a request with empty `options` is not supported in Nock'
  )
  t.end()
})

// https://github.com/nock/nock/issues/1558
test("mocked requests have 'method' property", t => {
  const scope = nock('http://example.test')
    .get('/somepath')
    .reply(200, {})

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
    t.end()
  })

  req.end()
})

// https://github.com/nock/nock/issues/1493
test("response has 'complete' property and it's true after end", t => {
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
        t.end()
      })
      // Streams start in 'paused' mode and must be started.
      // See https://nodejs.org/api/stream.html#stream_class_stream_readable
      res.resume()
    }
  )
  req.end()
})

test('Request with `Expect: 100-continue` triggers continue event', t => {
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
      t.end()
    })
  })

  req.on('continue', () => {
    req.end(exampleRequestBody)
  })
})

// https://github.com/nock/nock/issues/1836
test('when http.get and http.request have been overridden before nock overrides them, http.get calls through to the expected method', async t => {
  // TODO Investigate why this is needed when it's also in the `afterEach()`
  // hook in ./setup.
  t.on('end', () => {
    nock.restore()
    sinon.restore()
  })

  // Obtain the original `http.request()` and stub it out, as a library might.
  nock.restore()
  const overriddenRequest = sinon.stub(http, 'request').callThrough()
  const overriddenGet = sinon.stub(http, 'get').callThrough()

  // Let Nock override them again.
  nock.activate()

  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.end()
  })
  await new Promise(resolve => server.listen(resolve))

  const req = http.get(`http://localhost:${server.address().port}`)
  expect(overriddenGet).to.have.been.calledOnce()
  expect(overriddenRequest).not.to.have.been.called()

  req.abort()
  server.close()
})

// https://github.com/nock/nock/issues/1836
test('when http.get and http.request have been overridden before nock overrides them, http.request calls through to the expected method', async t => {
  t.on('end', () => {
    nock.restore()
    sinon.restore()
  })

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
