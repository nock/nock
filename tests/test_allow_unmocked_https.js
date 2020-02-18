'use strict'

const { expect } = require('chai')
const nock = require('..')
const ssl = require('./ssl')
const got = require('./got_client')

require('./setup')

describe('allowUnmocked option (https)', () => {
  let server

  afterEach(() => {
    if (server) {
      server.close()
      server = null
    }
  })

  it('Nock with allowUnmocked and an url match', async () => {
    server = await ssl.startServer((req, res) => {
      res.writeHead(200)
      res.end({ status: 'default' })
    })
    const url = `https://127.0.0.1:${server.address().port}`

    const scope = nock(url, { allowUnmocked: true })
      .get('/urlMatch')
      .reply(201, JSON.stringify({ status: 'intercepted' }))

    const { body, statusCode } = await got(`${url}/urlMatch`, { ca: ssl.ca })

    expect(statusCode).to.equal(201)
    expect(body).to.equal('{"status":"intercepted"}')

    scope.done()
  })

  it('allow unmocked option works with https', async () => {
    server = await ssl.startServer((request, response) => {
      if (request.url === '/does/not/exist') {
        response.writeHead(404)
        response.end()
        return
      }

      response.writeHead(200)
      response.write('server response')
      response.end()
    })

    const { port } = server.address()
    const url = `https://localhost:${port}`
    const client = got.extend({
      prefixUrl: url,
      ca: ssl.ca,
      throwHttpErrors: false,
    })

    const scope = nock(url, { allowUnmocked: true })
      .get('/abc')
      .reply(200, 'mocked response')
      .get('/wont/get/here')
      .reply(500)

    const response1 = await client('abc')
    expect(response1.statusCode).to.equal(200)
    expect(response1.body).to.equal('mocked response')
    expect(scope.isDone()).to.equal(false)
    const response2 = await client('does/not/exist')

    expect(response2.statusCode).to.equal(404)
    expect(scope.isDone()).to.equal(false)
    const response3 = await client('')

    expect(response3.statusCode).to.equal(200)
    expect(response3.body).to.equal('server response')
    expect(scope.isDone()).to.equal(false)
  })

  it('allow unmocked option works with https for a partial match', async () => {
    // The `allowUnmocked` option is processed in two places. Once in the intercept when there
    // are no interceptors that come close to matching the request. And again in the overrider when
    // there are interceptors that partially match, eg just path, but don't completely match.
    // This explicitly tests the later case in the overrider by making an HTTPS request for a path
    // that has an interceptor but fails to match the query constraint.
    server = await ssl.startServer((request, response) => {
      response.writeHead(201)
      response.write('foo')
      response.end()
    })

    const { port } = server.address()
    const origin = `https://localhost:${port}`

    nock(origin, { allowUnmocked: true })
      .get('/foo')
      .query({ foo: 'bar' })
      .reply(418)

    // no query so wont match the interceptor
    const { statusCode, body } = await got(`${origin}/foo`, { ca: ssl.ca })

    expect(statusCode).to.equal(201)
    expect(body).to.equal('foo')
  })
})
