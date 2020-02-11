'use strict'

const http = require('http')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

require('./setup')

describe('allowUnmocked option', () => {
  let _server

  afterEach(() => {
    if (_server) {
      _server.close()
      _server = null
    }
  })

  async function createServer(requestListener) {
    const server = http.createServer(requestListener)
    await new Promise(resolve => server.listen(resolve))
    _server = server

    const url = `http://localhost:${server.address().port}`
    return { server, url }
  }

  it('with allowUnmocked, mocked request still works', async () => {
    const scope = nock('http://example.test', { allowUnmocked: true })
      .post('/')
      .reply(200, '99problems')

    const { body, statusCode } = await got.post('http://example.test/')
    expect(statusCode).to.equal(200)
    expect(body).to.equal('99problems')

    scope.done()
  })

  it('allow unmocked works after one interceptor is removed', async () => {
    const { url } = await createServer((request, response) => {
      response.write('live')
      response.end()
    })

    nock(url, { allowUnmocked: true })
      .get('/')
      .reply(200, 'Mocked')

    expect((await got(url)).body).to.equal('Mocked')
    expect((await got(url)).body).to.equal('live')
  })

  it('allow unmocked option allows traffic to server', async () => {
    const { url } = await createServer((request, response) => {
      switch (request.url) {
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

    const scope = nock(url, { allowUnmocked: true })
      .get('/abc')
      .reply(304, 'served from our mock')
      .get('/wont/get/here')
      .reply(304, 'served from our mock')
    const client = got.extend({ baseUrl: url, throwHttpErrors: false })

    const response1 = await client(`${url}/abc`)
    expect(response1.statusCode).to.equal(304)
    expect(response1.body).to.equal('served from our mock')
    expect(scope.isDone()).to.equal(false)

    const response2 = await client(`${url}/not/available`)
    expect(response2.statusCode).to.equal(404)
    expect(scope.isDone()).to.equal(false)

    const response3 = await client(`${url}/`)
    expect(response3.statusCode).to.equal(200)
    expect(response3.body).to.equal('server served a response')
    expect(scope.isDone()).to.equal(false)
  })

  it('allow unmocked post with json data', async () => {
    const { url } = await createServer((request, response) => {
      response.writeHead(200)
      response.write('{"message":"server response"}')
      response.end()
    })

    nock(url, { allowUnmocked: true })
      .get('/not/accessed')
      .reply(200, '{"message":"mocked response"}')

    const { body, statusCode } = await got.post(url, {
      json: true,
      body: { some: 'data' },
    })
    expect(statusCode).to.equal(200)
    expect(body).to.deep.equal({ message: 'server response' })
  })

  it('allow unmocked passthrough with mismatched bodies', async () => {
    const { url } = await createServer((request, response) => {
      response.writeHead(200)
      response.write('{"message":"server response"}')
      response.end()
    })

    nock(url, { allowUnmocked: true })
      .post('/post', { some: 'other data' })
      .reply(404, '{"message":"server response"}')

    const { body, statusCode } = await got.post(`${url}/post`, {
      json: true,
      body: { some: 'data' },
    })
    expect(statusCode).to.equal(200)
    expect(body).to.deep.equal({ message: 'server response' })
  })

  it('match path using regexp with allowUnmocked', async () => {
    const scope = nock('http://example.test', { allowUnmocked: true })
      .get(/regex$/)
      .reply(200, 'Match regex')

    const { body, statusCode } = await got(
      'http://example.test/resources/regex'
    )
    expect(statusCode).to.equal(200)
    expect(body).to.equal('Match regex')

    scope.done()
  })

  // https://github.com/nock/nock/issues/1076
  it('match hostname using regexp with allowUnmocked', async () => {
    const scope = nock(/localhost/, { allowUnmocked: true })
      .get('/no/regex/here')
      .reply(200, 'Match regex')

    const { body, statusCode } = await got(
      'http://localhost:3000/no/regex/here'
    )
    expect(statusCode).to.equal(200)
    expect(body).to.equal('Match regex')

    scope.done()
  })

  // https://github.com/nock/nock/issues/1867
  it('match path using callback with allowUnmocked', async () => {
    const scope = nock('http://example.test', { allowUnmocked: true })
      .get(uri => uri.endsWith('bar'))
      .reply()

    const { statusCode } = await got('http://example.test/foo/bar')
    expect(statusCode).to.equal(200)

    scope.done()
  })

  // https://github.com/nock/nock/issues/835
  it('match multiple paths to domain using regexp with allowUnmocked', async () => {
    const { url } = await createServer((request, response) => {
      response.write('live')
      response.end()
    })

    const scope1 = nock(/localhost/, { allowUnmocked: true })
      .get(/alpha/)
      .reply(200, 'this is alpha')

    const scope2 = nock(/localhost/, { allowUnmocked: true })
      .get(/bravo/)
      .reply(200, 'bravo, bravo!')

    expect((await got(`${url}`)).body).to.equal('live')
    expect((await got(`${url}/alphalicious`)).body).to.equal('this is alpha')
    expect((await got(`${url}/bravo-company`)).body).to.equal('bravo, bravo!')

    scope1.done()
    scope2.done()
  })

  it('match domain and path with literal query params and allowUnmocked', async () => {
    const scope = nock('http://example.test', { allowUnmocked: true })
      .get('/foo?bar=baz')
      .reply()

    const { statusCode } = await got('http://example.test/foo?bar=baz')

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('match domain and path using regexp with query params and allowUnmocked', async () => {
    const imgResponse = 'Matched Images Page'

    const scope = nock(/example/, { allowUnmocked: true })
      .get(/imghp\?hl=en/)
      .reply(200, imgResponse)

    const { body, statusCode } = await got('http://example.test/imghp?hl=en')
    expect(statusCode).to.equal(200)
    expect(body).to.equal(imgResponse)

    scope.done()
  })

  // https://github.com/nock/nock/issues/490
  it('match when query is specified with allowUnmocked', async () => {
    const { url } = await createServer((request, response) => {
      response.write('live')
      response.end()
    })

    const scope = nock(url, { allowUnmocked: true })
      .get('/search')
      .query({ q: 'cat pictures' })
      .reply(200, '😻')

    expect((await got(url)).body).to.equal('live')
    expect((await got(`${url}/search?q=cat%20pictures`)).body).to.equal('😻')

    scope.done()
  })
})
