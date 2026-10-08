import { expect } from 'chai'
import http from 'node:http'
import zlib from 'node:zlib'
import nock from '../index.ts'

for (const encodings of [
  ['gzip', 'deflate'],
  ['deflate', 'gzip'],
  ['gzip', 'br'],
  ['gzip', 'gzip'],
  ['gzip', 'deflate', 'br'],
  ['br'],
  [],
]) {
  it(`decodes all request content codings in reverse order: ${encodings}`, async () => {
    const message = { my: 'contents' }
    const compressors = {
      gzip: zlib.gzipSync,
      deflate: zlib.deflateSync,
      br: zlib.brotliCompressSync,
    }
    const compressed = encodings.reduce(
      (body, encoding) => compressors[encoding](body),
      Buffer.from(JSON.stringify(message)),
    )
    const scope = nock('http://example.test')
      .post('/', message)
      .reply(async request => {
        expect(await request.json()).to.deep.equal(message)
        return [201, 'decoded']
      })

    const response = await new Promise((resolve, reject) => {
      const req = http.request(
        'http://example.test/',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-encoding': encodings.join(', '),
          },
        },
        res => {
          let body = ''
          res.on('data', chunk => {
            body += chunk
          })
          res.on('end', () => resolve({ statusCode: res.statusCode, body }))
          res.on('error', reject)
        },
      )
      req.on('error', reject)
      req.end(compressed)
    })
    expect(response).to.deep.equal({ statusCode: 201, body: 'decoded' })
    scope.done()
  })
}

it('should accept and decode gzip encoded application/json', done => {
  const message = {
    my: 'contents',
  }

  nock('http://example.test')
    .post('/')
    .reply(async request => {
      expect(await request.json()).to.deep.equal(message)
      done()
      return [200]
    })

  const req = http.request({
    hostname: 'example.test',
    path: '/',
    method: 'POST',
    headers: {
      'content-encoding': 'gzip',
      'content-type': 'application/json',
    },
  })

  const compressedMessage = zlib.gzipSync(JSON.stringify(message))
  req.write(compressedMessage)
  req.end()
})

it('should accept and decode gzip encoded application/json, when headers come from a client as an array', done => {
  const message = {
    my: 'contents',
  }

  const scope = nock('http://example.test').post('/', message).reply(200)

  const req = http.request({
    hostname: 'example.test',
    path: '/',
    method: 'POST',
    headers: {
      'content-encoding': ['gzip'],
      'content-type': ['application/json'],
    },
  })
  req.on('response', () => {
    scope.done()
    done()
  })

  const compressedMessage = zlib.gzipSync(JSON.stringify(message))
  req.write(compressedMessage)
  req.end()
})

it('should accept and decode deflate encoded application/json', done => {
  const message = {
    my: 'contents',
  }

  nock('http://example.test')
    .post('/')
    .reply(async request => {
      expect(await request.json()).to.deep.equal(message)
      done()
      return [200]
    })

  const req = http.request({
    hostname: 'example.test',
    path: '/',
    method: 'POST',
    headers: {
      'content-encoding': 'deflate',
      'content-type': 'application/json',
    },
  })

  const compressedMessage = zlib.deflateSync(JSON.stringify(message))

  req.write(compressedMessage)
  req.end()
})
