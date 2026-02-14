'use strict'

const { expect } = require('chai')
const assertRejects = require('assert-rejects')
const nock = require('../..')
const got = require('./got_client')
const { startHttpServer } = require('../servers')

describe('`passthrough()`', () => {
  it('forwards request to the real server', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('real response')
      response.end()
    })

    const scope = nock(origin).get('/test').passthrough()

    const { body, statusCode } = await got(`${origin}/test`)
    expect(statusCode).to.equal(200)
    expect(body).to.equal('real response')
    scope.done()
  })

  it('non-matching request is not passed through', async () => {
    nock('http://example.test').get('/specific').passthrough()

    await assertRejects(
      got('http://example.test/other'),
      /Response code 501/,
    )
  })

  it('mixed mocked and passthrough on the same scope', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('real')
      response.end()
    })

    const scope = nock(origin)
      .get('/mocked')
      .reply(200, 'fake')
      .get('/real')
      .passthrough()

    const mockedRes = await got(`${origin}/mocked`)
    expect(mockedRes.body).to.equal('fake')

    const realRes = await got(`${origin}/real`)
    expect(realRes.body).to.equal('real')

    scope.done()
  })

  it('passthrough with query matching', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('real data')
      response.end()
    })

    const scope = nock(origin).get('/api').query({ live: 'true' }).passthrough()

    const { body } = await got(`${origin}/api?live=true`)
    expect(body).to.equal('real data')
    scope.done()
  })

  it('passthrough does not match with wrong query', async () => {
    nock('http://example.test')
      .get('/api')
      .query({ live: 'true' })
      .passthrough()

    await assertRejects(
      got('http://example.test/api?live=false'),
      /Response code 501/,
    )
  })

  it('passthrough with header matching', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('matched')
      response.end()
    })

    const scope = nock(origin)
      .get('/')
      .matchHeader('authorization', /^Bearer /)
      .passthrough()

    const { body } = await got(origin, {
      headers: { authorization: 'Bearer token123' },
    })
    expect(body).to.equal('matched')
    scope.done()
  })

  it('passthrough does not match with wrong headers', async () => {
    nock('http://example.test')
      .get('/')
      .matchHeader('authorization', /^Bearer /)
      .passthrough()

    await assertRejects(
      got('http://example.test', {
        headers: { authorization: 'Basic abc123' },
      }),
      /Response code 501/,
    )
  })

  it('passthrough with body matching', async () => {
    const { origin } = await startHttpServer((request, response) => {
      let data = ''
      request.on('data', chunk => {
        data += chunk
      })
      request.on('end', () => {
        response.writeHead(200)
        response.write(`echo: ${data}`)
        response.end()
      })
    })

    const scope = nock(origin).post('/submit', 'hello').passthrough()

    const { body } = await got.post(`${origin}/submit`, {
      body: 'hello',
    })
    expect(body).to.equal('echo: hello')
    scope.done()
  })

  it('passthrough does not match with wrong body', async () => {
    nock('http://example.test').post('/submit', 'hello').passthrough()

    await assertRejects(
      got.post('http://example.test/submit', { body: 'goodbye' }),
      /Response code 501/,
    )
  })

  it('passthrough respects `times()`', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('real')
      response.end()
    })

    nock(origin).get('/').times(2).passthrough()

    await got(origin)
    await got(origin)

    await assertRejects(got(origin), /Response code 501/)
  })

  it('passthrough with `persist()`', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('real')
      response.end()
    })

    const scope = nock(origin).get('/').passthrough().persist()

    for (let i = 0; i < 5; i++) {
      const { body } = await got(origin)
      expect(body).to.equal('real')
    }

    scope.done()
  })

  it('`isDone()` reflects passthrough consumption', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('ok')
      response.end()
    })

    const scope = nock(origin).get('/').passthrough()

    expect(scope.isDone()).to.be.false()

    await got(origin)

    expect(scope.isDone()).to.be.true()
  })

  it('`scope.done()` throws when passthrough is not consumed', () => {
    const scope = nock('http://example.test').get('/').passthrough()

    expect(() => scope.done()).to.throw(Error, 'Mocks not yet satisfied')
  })

  it('passthrough interceptors appear in `pendingMocks()`', () => {
    nock('http://example.test').get('/path').passthrough()

    expect(nock.pendingMocks()).to.have.lengthOf(1)
    expect(nock.pendingMocks()[0]).to.equal('GET http://example.test:80/path')
  })

  it('passthrough interceptors appear in `activeMocks()`', () => {
    nock('http://example.test').get('/path').passthrough()

    expect(nock.activeMocks()).to.have.lengthOf(1)
    expect(nock.activeMocks()[0]).to.equal('GET http://example.test:80/path')
  })

  it('optional passthrough does not appear in `pendingMocks()`', () => {
    nock('http://example.test').get('/maybe').optionally().passthrough()

    expect(nock.pendingMocks()).to.be.empty()
  })

  it('passthrough works with `disableNetConnect()`', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.write('allowed')
      response.end()
    })

    nock.disableNetConnect()
    const scope = nock(origin).get('/').passthrough()

    const { body } = await got(origin)
    expect(body).to.equal('allowed')
    scope.done()
  })

  it('allowUnmocked scope option is carried to interceptor via passthrough()', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(200)
      response.end('live')
    })

    nock(origin, { allowUnmocked: true }).get('/passthrough').passthrough()

    // An unmocked route should pass through to the real server
    // because allowUnmocked is set at the scope level and must
    // be propagated to interceptor.options via passthrough().
    const response = await fetch(`${origin}/unmocked`)
    expect(response.status).to.equal(200)
    expect(await response.text()).to.equal('live')
  })
})
