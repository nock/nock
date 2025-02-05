'use strict'

const zlib = require('zlib')
const { expect } = require('chai')
const nock = require('..')
const assertRejects = require('assert-rejects')
const { startHttpServer } = require('./servers')

describe('Native Fetch', () => {
  it('input is string', async () => {
    const scope = nock('http://example.test').get('/').reply()

    const { status } = await fetch('http://example.test/')
    expect(status).to.equal(200)
    scope.done()
  })

  it('input is URL', async () => {
    const scope = nock('http://example.test').get('/').reply()

    const { status } = await fetch(new URL('http://example.test/'))
    expect(status).to.equal(200)
    scope.done()
  })

  it('input is Request object', async () => {
    const scope = nock('http://example.test').get('/').reply()

    const { status } = await fetch(new Request('http://example.test/'))
    expect(status).to.equal(200)
    scope.done()
  })

  it('filter by body', async () => {
    const scope = nock('http://example.test')
      .post('/', { test: 'fetch' })
      .reply()

    const { status } = await fetch('http://example.test/', {
      method: 'POST',
      body: JSON.stringify({ test: 'fetch' }),
    })
    expect(status).to.equal(200)
    scope.done()
  })

  it('filter by request body', async () => {
    const scope = nock('http://example.test')
      .post('/', { test: 'fetch' })
      .reply()

    const { status } = await fetch(
      new Request('http://example.test/', {
        method: 'POST',
        body: JSON.stringify({ test: 'fetch' }),
      }),
    )
    expect(status).to.equal(200)
    scope.done()
  })

  it('no match', async () => {
    nock('http://example.test').get('/').reply()

    await assertRejects(
      fetch('http://example.test/wrong-path'),
      /Nock: No match for request/,
    )
  })

  it('forward request if no mock', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.write('live')
      response.end()
    })

    const { status } = await fetch(origin)
    expect(status).to.equal(200)
  })

  it('should work with empty response', async () => {
    nock('http://example.test').get('/').reply(204)

    const { status } = await fetch('http://example.test')
    expect(status).to.equal(204)
  })

  it('should work https', async () => {
    nock('https://example.test').get('/').reply()

    const { status } = await fetch('https://example.test')
    expect(status).to.equal(200)
  })

  it('should set the statusText according to the response code', async () => {
    nock('https://example.test').get('/').reply(404)

    const { status, statusText } = await fetch('https://example.test')
    expect(status).to.equal(404)
    expect(statusText).to.equal('Not Found')
  })

  it('should return mocked response', async () => {
    const message = 'Lorem ipsum dolor sit amet'
    const scope = nock('http://example.test').get('/foo').reply(200, message)

    const response = await fetch('http://example.test/foo')

    expect(response.status).to.equal(200)
    expect(await response.text()).to.equal(message)
    scope.done()
  })

  it('should support body cancellation', async () => {
    const scope = nock('http://test').post('/').reply(200)

    const response = await fetch('http://test', { method: 'POST' })
    await response.body.cancel()
    scope.done()
  })

  it('should abort a request with a timeout signal', async () => {
    const scope = nock('http://test.com').get('/').delayBody(100).reply(200)

    const response = await fetch('http://test.com', {
      signal: AbortSignal.timeout(50),
    })
    await assertRejects(
      response.text(),
      'TimeoutError: The operation was aborted due to timeout',
    )
    scope.done()
  })

  // https://github.com/nock/nock/issues/2768
  it('should not mess the Headers object', async () => {
    nock('https://api.test.com', {
      reqheaders: { 'Content-Type': 'application/json' },
    })
      .get('/data')
      .times(2)
      .reply(200)

    const headers = new Headers({ 'Content-Type': 'application/json' })

    await fetch('https://api.test.com/data', { headers })
    await fetch('https://api.test.com/data', { headers })
  })

  // https://github.com/nock/nock/issues/2780
  it('should not mess the Headers object', async () => {
    nock('https://api.test.com', {
      reqheaders: { 'Content-Type': 'application/json' },
    })
      .get('/data')
      .times(2)
      .reply(200)

    const headers = new Headers({ 'Content-Type': 'application/json' })

    await fetch('https://api.test.com/data', { headers })
    await fetch('https://api.test.com/data', { headers })
  })

  describe('content-encoding', () => {
    it('should accept gzipped content', async () => {
      const message = 'Lorem ipsum dolor sit amet'
      const compressed = zlib.gzipSync(message)

      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, compressed, {
          'X-Transfer-Length': String(compressed.length),
          'Content-Length': undefined,
          'Content-Encoding': 'gzip',
        })
      const response = await fetch('http://example.test/foo')

      expect(response.status).to.equal(200)
      expect(await response.text()).to.equal(message)
      scope.done()
    })

    it('should accept deflated content', async () => {
      const message = 'Lorem ipsum dolor sit amet'
      const compressed = zlib.deflateSync(message)

      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, compressed, {
          'X-Transfer-Length': String(compressed.length),
          'Content-Length': undefined,
          'Content-Encoding': 'deflate',
        })
      const response = await fetch('http://example.test/foo')

      expect(response.status).to.equal(200)
      expect(await response.text()).to.equal(message)
      scope.done()
    })

    it('should accept brotli content', async () => {
      const message = 'Lorem ipsum dolor sit amet'
      const compressed = zlib.brotliCompressSync(message)

      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, compressed, {
          'X-Transfer-Length': String(compressed.length),
          'Content-Length': undefined,
          'Content-Encoding': 'br',
        })
      const response = await fetch('http://example.test/foo')

      expect(response.status).to.equal(200)
      expect(await response.text()).to.equal(message)
      scope.done()
    })

    it('should accept gzip and broti content', async () => {
      const message = 'Lorem ipsum dolor sit amet'
      const compressed = zlib.brotliCompressSync(zlib.gzipSync(message))

      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, compressed, {
          'X-Transfer-Length': String(compressed.length),
          'Content-Length': undefined,
          'Content-Encoding': 'gzip, br',
        })
      const response = await fetch('http://example.test/foo')

      expect(response.status).to.equal(200)
      expect(await response.text()).to.equal(message)
      scope.done()
    })

    it('should accept gzip and deflate content', async () => {
      const message = 'Lorem ipsum dolor sit amet'
      const compressed = zlib.deflateSync(zlib.gzipSync(message))

      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, compressed, {
          'X-Transfer-Length': String(compressed.length),
          'Content-Length': undefined,
          'Content-Encoding': 'gzip, deflate',
        })
      const response = await fetch('http://example.test/foo')

      expect(response.status).to.equal(200)
      expect(await response.text()).to.equal(message)
      scope.done()
    })

    it('should pass through the result if a not supported encoding was used', async () => {
      const message = 'Lorem ipsum dolor sit amet'
      const compressed = Buffer.from(message)
      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, compressed, {
          'X-Transfer-Length': String(compressed.length),
          'Content-Length': undefined,
          'Content-Encoding': 'invalid',
        })
      const response = await fetch('http://example.test/foo')
      expect(response.status).to.equal(200)
      expect(await response.text()).to.equal(message)
      scope.done()
    })

    it('should throw error if wrong encoding is used', async () => {
      const message = 'Lorem ipsum dolor sit amet'
      const compressed = zlib.gzipSync(message)

      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, compressed, {
          'X-Transfer-Length': String(message.length),
          'Content-Length': undefined,
          'Content-Encoding': 'br',
        })
      const response = await fetch('http://example.test/foo')
      await response
        .text()
        .then(() => {
          throw new Error('Should have thrown')
        })
        .catch(e => {
          expect(e.message).to.contain('Decompression failed')
          scope.done()
        })
    })

    // May be a bug in Node.js which swallows the error. Need to investigate it further
    it.skip('should throw error if encoding is used with uncompressed body', async () => {
      const message = 'Lorem ipsum dolor sit amet'

      const scope = nock('http://example.test')
        .get('/foo')
        .reply(200, Buffer.from(message), {
          'X-Transfer-Length': String(message.length),
          'Content-Length': undefined,
          'Content-Encoding': 'br',
        })
      const response = await fetch('http://example.test/foo')
      await response
        .text()
        .then(() => {
          throw new Error('Should have thrown')
        })
        .catch(e => {
          expect(e.message).to.contain('Decompression failed')
          scope.done()
        })
    })
  })

  describe('redirect', () => {
    let origin

    beforeEach(async () => {
      const server = await startHttpServer((request, response) => {
        if (request.url === '/redirected') {
          response.writeHead(200).end('redirected')
        } else {
          response.writeHead(302, { Location: '/redirected' }).end()
        }
      })

      origin = server.origin
    })

    it('should follow a bypassed redirect response', async () => {
      const response = await fetch(origin)
      expect(response.status).to.eq(200)
      expect(await response.text()).to.eq('redirected')
    })

    it('should follows a mocked redirect to the original server', async () => {
      nock(origin, { allowUnmocked: true })
        .get('/')
        .reply(302, '', { Location: `${origin}/redirected` })

      const response = await fetch(origin)
      expect(response.status).to.eq(200)
      expect(await response.text()).to.eq('redirected')
    })

    it('should follows a mocked relative redirect to the original server', async () => {
      nock(origin, { allowUnmocked: true })
        .get('/')
        .reply(302, '', { Location: `/redirected` })

      const response = await fetch(origin)
      expect(response.status).to.eq(200)
      expect(await response.text()).to.eq('redirected')
    })

    it('should follows a mocked redirect to a mocked response', async () => {
      nock(origin)
        .get('/')
        .reply(302, '', { Location: `${origin}/redirected` })
      nock(origin).get('/redirected').reply(200, 'mocked')

      const response = await fetch(origin)
      expect(response.status).to.eq(200)
      expect(await response.text()).to.eq('mocked')
    })

    it('should returns the redirect response as-is for a request with "manual" redirect mode', async () => {
      nock(origin)
        .get('/')
        .reply(302, '', { Location: `${origin}/redirected` })

      const response = await fetch(origin, { redirect: 'manual' })
      expect(response.status).to.eq(302)
      expect(response.headers.get('location')).to.eq(`${origin}/redirected`)
    })

    it('should throws a network error on a redirect for a request with "error" redirect mode', async () => {
      nock(origin)
        .get('/')
        .reply(302, '', { Location: `${origin}/redirected` })

      await assertRejects(
        fetch(origin, { redirect: 'error' }),
        /Failed to fetch/,
      )
    })

    it('should throws a network error on a non-303 redirect with a body', async () => {
      nock(origin)
        .post('/')
        .reply(302, '', { Location: `${origin}/redirected` })

      await assertRejects(
        fetch(origin, { method: 'POST', body: 'Hello' }),
        /Failed to fetch/,
      )
    })

    it('should throws a network error on redirects to a non-HTTP scheme', async () => {
      nock(origin).get('/').reply(302, '', { Location: `wss://localhost` })

      await assertRejects(fetch(origin), /Failed to fetch/)
    })

    it('should throws on a redirect with credentials for a "cors" request', async () => {
      nock(origin)
        .get('/')
        .reply(302, '', { Location: `http://user:password@localhost` })

      await assertRejects(fetch(origin, { mode: 'cors' }), /Failed to fetch/)
    })

    it('should coerces a 301/302 redirect for a POST request to a GET request', async () => {
      let body, headers
      nock(origin)
        .post('/')
        .reply(302, '', { Location: `${origin}/redirected` })
      nock(origin)
        .get('/redirected')
        .reply(200, function (uri, requestBody) {
          body = requestBody
          headers = this.req.headers
        })

      const response = await fetch(origin, {
        method: 'POST',
        headers: {
          'content-language': 'en-US',
          'content-location': 'http://localhost/redirected',
          'content-type': 'application/json',
          'content-length': '0',
          'x-other-header': 'value',
        },
      })

      expect(response.status).to.eq(200)
      // Must remove body-related request headers.
      expect(headers).to.deep.eq({
        'x-other-header': 'value',
        host: new URL(origin).host,
      })
      // Non-GET/HEAD request body of a 303 redirect must be null.
      expect(body).to.be.empty()
    })

    it('should coerces a 303 redirect to a non-HEAD/GET request to a GET request', async () => {
      let body, headers
      nock(origin)
        .post('/')
        .reply(303, '', { Location: `${origin}/redirected` })
      nock(origin)
        .get('/redirected')
        .reply(200, function (uri, requestBody) {
          body = requestBody
          headers = this.req.headers
        })

      const response = await fetch(origin, {
        method: 'POST',
        headers: {
          'content-language': 'en-US',
          'content-location': 'http://localhost/redirected',
          'content-type': 'application/json',
          'content-length': '0',
          'x-other-header': 'value',
        },
      })

      expect(response.status).to.eq(200)
      // Must remove body-related request headers.
      expect(headers).to.deep.eq({
        'x-other-header': 'value',
        host: new URL(origin).host,
      })
      // Non-GET/HEAD request body of a 303 redirect must be null.
      expect(body).to.be.empty()
    })

    it('should deletes sensitive request headers for a cross-origin redirect', async () => {
      let body, headers
      nock(origin)
        .get('/')
        .reply(303, '', { Location: `https://anotherhost.com/redirected` })
      nock('https://anotherhost.com')
        .get('/redirected')
        .reply(200, function (uri, requestBody) {
          body = requestBody
          headers = this.req.headers
        })

      const response = await fetch(origin, {
        headers: {
          authorization: 'Bearer TOKEN',
          'proxy-authorization': 'Bearer PROXY_TOKEN',
          cookie: 'a=1',
          host: 'localhost',
          'x-other-header': 'value',
        },
      })

      expect(response.status).to.eq(200)
      expect(headers).to.deep.eq({
        'x-other-header': 'value',
        host: 'anotherhost.com',
      })
      expect(body).to.be.empty()
    })
  })

  describe('recording', () => {
    // Skip this test until the fix will be backported to all LTS versions.
    it.skip('records and replays gzipped nocks correctly', async () => {
      const exampleText = '<html><body>example</body></html>'

      const { origin } = await startHttpServer((request, response) => {
        // TODO: flip the order of the encoding, this is a bug in fetch
        // const body = zlib.brotliCompressSync(zlib.gzipSync(exampleText))
        const body = zlib.gzipSync(zlib.brotliCompressSync(exampleText))

        response.writeHead(200, { 'content-encoding': 'gzip, br' })
        response.end(body)
      })

      nock.restore()
      nock.recorder.clear()
      expect(nock.recorder.play()).to.be.empty()

      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
      })

      const response1 = await fetch(origin)
      expect(await response1.text()).to.equal(exampleText)
      expect(response1.headers.get('content-encoding')).to.equal('gzip, br')

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      expect(recorded).to.have.lengthOf(1)
      const nocks = nock.define(recorded)

      const response2 = await fetch(origin)
      expect(await response2.text()).to.equal(exampleText)
      expect(response1.headers.get('content-encoding')).to.equal('gzip, br')

      nocks.forEach(nock => nock.done())
    })

    it('records and replays deflated nocks correctly', async () => {
      const exampleText = '<html><body>example</body></html>'

      const { origin } = await startHttpServer((request, response) => {
        const body = zlib.deflateSync(exampleText)

        response.writeHead(200, { 'content-encoding': 'deflate' })
        response.end(body)
      })

      nock.restore()
      nock.recorder.clear()
      expect(nock.recorder.play()).to.be.empty()

      nock.recorder.rec({
        dont_print: true,
        output_objects: true,
      })

      const response1 = await fetch(origin)
      expect(await response1.text()).to.equal(exampleText)
      expect(response1.headers.get('content-encoding')).to.equal('deflate')

      nock.restore()
      const recorded = nock.recorder.play()
      nock.recorder.clear()
      nock.activate()

      expect(recorded).to.have.lengthOf(1)
      const nocks = nock.define(recorded)

      const response2 = await fetch(origin)
      expect(await response2.text()).to.equal(exampleText)
      expect(response1.headers.get('content-encoding')).to.equal('deflate')

      nocks.forEach(nock => nock.done())
    })
  })
})
