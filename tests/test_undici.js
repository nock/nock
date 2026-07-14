import { expect } from 'chai'
import { Readable } from 'node:stream'
import undici from 'undici'
import nock from '../index.ts'
import { startHttpServer } from './servers/index.js'

describe('Undici', () => {
  it('GET request with query and response headers', async () => {
    nock('http://example.test')
      .get('/test')
      .query({ a: 1 })
      .reply(200, 'OK', { test: 'header' })
    const response = await undici.request('http://example.test/test', {
      query: { a: 1 },
    })

    expect(response).to.deep.include({
      statusCode: 200,
      headers: { test: 'header' },
    })
    expect(await response.body.text()).to.equal('OK')
  })

  it('query options overrides URL query', async () => {
    const scope = nock('http://example.test')
      .get('/test')
      .query({ a: 1 })
      .reply(200)

    await undici.request('http://example.test/test?a=2', {
      query: { a: 1 },
    })

    scope.done()
  })

  it('GET request with query in path', async () => {
    const scope = nock('http://example.test')
      .get('/test')
      .query({ a: 1 })
      .reply(200)

    await undici.request('http://example.test/test?a=1')

    scope.done()
  })

  it('POST request', async () => {
    let requestBody
    nock('http://example.test')
      .post('/test', body => {
        requestBody = body
        return true
      })
      .reply(200)
    const response = await undici.request('http://example.test/test', {
      method: 'POST',
      body: 'test',
    })

    expect(response.statusCode).to.be.eq(200)
    expect(requestBody).to.be.eq('test')
  })

  it('POST using fetch', async () => {
    let requestBody
    nock('http://example.test')
      .post('/test', body => {
        requestBody = body
        return true
      })
      .reply(200)
    const response = await undici.fetch('http://example.test/test', {
      method: 'POST',
      body: 'test',
    })

    expect(response.status).to.be.eq(200)
    expect(requestBody).to.be.eq('test')
  })

  it('GET using fetch', async () => {
    nock('http://example.test').get('/test').reply(200)
    const response = await undici.fetch('http://example.test/test', {
      method: 'GET',
    })

    expect(response.status).to.be.eq(200)
  })

  it('forward request if no mock', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.write('live')
      response.end()
    })

    const { statusCode } = await undici.request(origin)
    expect(statusCode).to.equal(200)
  })

  it('passthrough forwards a buffered (Buffer) body', async () => {
    let receivedBody = ''
    const { origin } = await startHttpServer((request, response) => {
      request.on('data', chunk => {
        receivedBody += chunk
      })
      request.on('end', () => {
        response.writeHead(200)
        response.end()
      })
    })

    const scope = nock(origin).post('/submit').passthrough()

    const { body } = await undici.request(`${origin}/submit`, {
      method: 'POST',
      body: Buffer.from('hello'),
    })
    await body.dump()

    expect(receivedBody).to.equal('hello')
    scope.done()
  })

  it('passthrough forwards a streamed (Readable) body', async () => {
    let receivedBody = ''
    const { origin } = await startHttpServer((request, response) => {
      request.on('data', chunk => {
        receivedBody += chunk
      })
      request.on('end', () => {
        response.writeHead(200)
        response.end()
      })
    })

    const scope = nock(origin).post('/submit').passthrough()

    const { body } = await undici.request(`${origin}/submit`, {
      method: 'POST',
      body: Readable.from(['hello']),
    })
    await body.dump()

    expect(receivedBody).to.equal('hello')
    scope.done()
  })

  it('passthrough forwards a streamed (fetch) body', async () => {
    let receivedBody = ''
    const { origin } = await startHttpServer((request, response) => {
      request.on('data', chunk => {
        receivedBody += chunk
      })
      request.on('end', () => {
        response.writeHead(200)
        response.end()
      })
    })

    const scope = nock(origin).post('/submit').passthrough()

    await undici.fetch(`${origin}/submit`, {
      method: 'POST',
      body: new URLSearchParams({ hello: 'world' }),
    })

    expect(receivedBody).to.equal('hello=world')
    scope.done()
  })
})
