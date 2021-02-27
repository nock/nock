'use strict'

const http = require('http')
const { expect } = require('chai')
const assertRejects = require('assert-rejects')
const nock = require('..')
const got = require('./got_client')

describe('`define()`', () => {
  it('is backward compatible', async () => {
    expect(
      nock.define([
        {
          scope: 'http://example.test',
          //  "port" has been deprecated
          port: 12345,
          method: 'GET',
          path: '/',
          //  "reply" has been deprecated
          reply: '500',
        },
      ])
    ).to.be.ok()

    await assertRejects(
      got('http://example.test:12345/'),
      ({ response: { statusCode } }) => {
        expect(statusCode).to.equal(500)
        return true
      }
    )
  })

  it('throws when reply is not a numeric string', () => {
    expect(() =>
      nock.define([
        {
          scope: 'http://example.test:1451',
          method: 'GET',
          path: '/',
          reply: 'frodo',
        },
      ])
    ).to.throw('`reply`, when present, must be a numeric string')
  })

  it('applies default status code when none is specified', async () => {
    const body = '�'

    expect(
      nock.define([
        {
          scope: 'http://example.test',
          method: 'POST',
          path: '/',
          body,
          response: '�',
        },
      ])
    ).to.have.lengthOf(1)

    const { statusCode } = await got.post('http://example.test/', { body })

    expect(statusCode).to.equal(200)
  })

  it('works when scope and port are both specified', async () => {
    const body = 'Hello, world!'

    expect(
      nock.define([
        {
          scope: 'http://example.test:1451',
          port: 1451,
          method: 'POST',
          path: '/',
          body,
          response: '�',
        },
      ])
    ).to.be.ok()

    const { statusCode } = await got.post('http://example.test:1451/', { body })

    expect(statusCode).to.equal(200)
  })

  it('throws the expected error when scope and port conflict', () => {
    expect(() =>
      nock.define([
        {
          scope: 'http://example.test:8080',
          port: 5000,
          method: 'POST',
          path: '/',
          body: 'Hello, world!',
          response: '�',
        },
      ])
    ).to.throw(
      'Mismatched port numbers in scope and port properties of nock definition.'
    )
  })

  it('throws the expected error when method is missing', () => {
    expect(() =>
      nock.define([
        {
          scope: 'http://example.test',
          path: '/',
          body: 'Hello, world!',
          response: 'yo',
        },
      ])
    ).to.throw('Method is required')
  })

  it('works with non-JSON responses', async () => {
    const exampleBody = '�'
    const exampleResponseBody = 'hey: �'

    expect(
      nock.define([
        {
          scope: 'http://example.test',
          method: 'POST',
          path: '/',
          body: exampleBody,
          status: 200,
          response: exampleResponseBody,
        },
      ])
    ).to.be.ok()

    const { statusCode, body } = await got.post('http://example.test/', {
      body: exampleBody,
      responseType: 'buffer',
    })

    expect(statusCode).to.equal(200)
    expect(body).to.be.an.instanceOf(Buffer)
    expect(body.toString()).to.equal(exampleResponseBody)
  })

  // TODO: There seems to be a bug here. When testing via `got` with
  // `{ encoding: false }` the body that comes back should be a buffer, but is
  // not. It's difficult to get this test to pass after porting it.
  // I think this bug has been fixed in Got v10, so this should be unblocked.
  it('works with binary buffers', done => {
    const exampleBody = '8001'
    const exampleResponse = '8001'

    expect(
      nock.define([
        {
          scope: 'http://example.test',
          method: 'POST',
          path: '/',
          body: exampleBody,
          status: 200,
          response: exampleResponse,
        },
      ])
    ).to.be.ok()

    const req = http.request(
      {
        host: 'example.test',
        method: 'POST',
        path: '/',
      },
      res => {
        expect(res.statusCode).to.equal(200)

        const dataChunks = []

        res.on('data', chunk => {
          dataChunks.push(chunk)
        })

        res.once('end', () => {
          const response = Buffer.concat(dataChunks)
          expect(response.toString('hex')).to.equal(exampleResponse)
          done()
        })
      }
    )

    req.on('error', () => {
      //  This should never happen.
      expect.fail()
      done()
    })

    req.write(Buffer.from(exampleBody, 'hex'))
    req.end()
  })

  it('uses reqheaders', done => {
    const auth = 'foo:bar'
    const authHeader = `Basic ${Buffer.from('foo:bar').toString('base64')}`
    const reqheaders = {
      host: 'example.test',
      authorization: authHeader,
    }

    expect(
      nock.define([
        {
          scope: 'http://example.test',
          method: 'GET',
          path: '/',
          status: 200,
          reqheaders,
        },
      ])
    ).to.be.ok()

    // Make a request which should match the mock that was configured above.
    // This does not hit the network.
    const req = http.request(
      {
        host: 'example.test',
        method: 'GET',
        path: '/',
        auth,
      },
      res => {
        expect(res.statusCode).to.equal(200)

        res.once('end', () => {
          expect(res.req.getHeaders(), reqheaders)
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )
    req.end()
  })

  it('uses badheaders', done => {
    expect(
      nock.define([
        {
          scope: 'http://example.test',
          method: 'GET',
          path: '/',
          status: 401,
          badheaders: ['x-foo'],
        },
        {
          scope: 'http://example.test',
          method: 'GET',
          path: '/',
          status: 200,
          reqheaders: {
            'x-foo': 'bar',
          },
        },
      ])
    ).to.be.ok()

    const req = http.request(
      {
        host: 'example.test',
        method: 'GET',
        path: '/',
        headers: {
          'x-foo': 'bar',
        },
      },
      res => {
        expect(res.statusCode).to.equal(200)

        res.once('end', () => {
          done()
        })
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )
    req.end()
  })
})
