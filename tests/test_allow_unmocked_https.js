'use strict'

const { expect } = require('chai')
const nock = require('..')

const got = require('./got_client')
const servers = require('./servers')

describe('allowUnmocked option (https)', () => {
  it('Nock with allowUnmocked and an url match', async () => {
    const { origin } = await servers.startHttpsServer((req, res) => {
      res.writeHead(200)
      res.end({ status: 'default' })
    })

    const scope = nock(origin, { allowUnmocked: true })
      .get('/urlMatch')
      .reply(201, JSON.stringify({ status: 'intercepted' }))

    const { body, statusCode } = await got(`${origin}/urlMatch`, {
      https: { certificateAuthority: servers.ca },
    })

    expect(statusCode).to.equal(201)
    expect(body).to.equal('{"status":"intercepted"}')

    scope.done()
  })

  it('allow unmocked option works with https', async () => {
    const { origin } = await servers.startHttpsServer((request, response) => {
      if (request.url === '/does/not/exist') {
        response.writeHead(404)
        response.end()
        return
      }

      response.writeHead(200)
      response.write('server response')
      response.end()
    })

    const client = got.extend({
      prefixUrl: origin,
      throwHttpErrors: false,
      https: { certificateAuthority: servers.ca },
    })

    const scope = nock(origin, { allowUnmocked: true })
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
    const { origin } = await servers.startHttpsServer((request, response) => {
      response.writeHead(201)
      response.write('foo')
      response.end()
    })

    nock(origin, { allowUnmocked: true })
      .get('/foo')
      .query({ foo: 'bar' })
      .reply(418)

    // no query so wont match the interceptor
    const { statusCode, body } = await got(`${origin}/foo`, {
      https: { certificateAuthority: servers.ca },
    })

    expect(statusCode).to.equal(201)
    expect(body).to.equal('foo')
  })
})
