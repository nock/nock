'use strict'

const { expect } = require('chai')
const http = require('http')
const nock = require('..')

async function sendRequest(host, path) {
  const req1 = new http.ClientRequest({
    host: host,
    path: path,
  })

  req1.end()

  await new Promise((resolve) => {
    req1.on('response', resolve)
  })
}

describe('Request history', () => {
  afterEach(() => {
    nock.cleanAll();
  })

  it('remembers requests', async () => {
    const interceptor1 = nock('http://example.test')
        .persist()
        .get(/\/dsad1.*/)
        .remember()
    interceptor1.reply(202, '1')

    const interceptor2 = nock('http://example.test')
        .persist()
        .get(/\/dsad2.*/)
        .remember()
    interceptor2.reply(202, '2')

    await sendRequest('example.test', '/dsad1?foo=bar')
    await sendRequest('example.test', '/dsad1?foo=qux')

    expect(interceptor1.requests).to.have.lengthOf(2);
    expect(interceptor1.requests[0].path).to.equal('/dsad1?foo=bar')
    expect(interceptor1.requests[1].path).to.equal('/dsad1?foo=qux')
    expect(interceptor2.requests).to.be.empty;
  })

  it('remembers up to 2 requests', async () => {
    const interceptor = nock('http://example.test')
        .persist()
        .get('/foo')
        .remember(2)

    interceptor.reply(202, '1')

    for (let i = 0; i < 4; i++) {
      await sendRequest('example.test', '/foo')
    }

    expect(interceptor.requests).to.have.lengthOf(2);
  })

  it('remembers all requests', async () => {
    const interceptor = nock('http://example.test')
        .persist()
        .get('/foo')
        .remember()

    interceptor.reply(202, '1')

    for (let i = 0; i < 20; i++) {
      await sendRequest('example.test', '/foo')
    }

    expect(interceptor.requests).to.have.lengthOf(20);
  })

  it('remembers no requests', async () => {
    const interceptor = nock('http://example.test')
        .persist()
        .get('/foo')

    interceptor.reply(202, '1')

    await sendRequest('example.test', '/foo')
    await sendRequest('example.test', '/foo')

    expect(interceptor.requests).to.have.lengthOf(0);
  })

  it('clears the history', async () => {
    const interceptor = nock('http://example.test')
        .persist()
        .get('/foo')
        .remember()

    interceptor.reply(202, '1')

    await sendRequest('example.test', '/foo')
    expect(interceptor.requests).to.have.lengthOf(1);

    interceptor.clearRequestHistory()
    expect(interceptor.requests).to.have.lengthOf(0);

    await sendRequest('example.test', '/foo')
    expect(interceptor.requests).to.have.lengthOf(1);
  })
})
