'use strict'

const { expect } = require('chai')
const http = require('http')
const nock = require('..')

describe('Request history', () => {
  afterEach(() => {
    nock.cleanAll();
  })

  it('remembers requests', async () => {
    const interceptor1 = nock('http://example.test').persist().get(/\/dsad1.*/)
    interceptor1.reply(202, '1')

    const interceptor2 = nock('http://example.test').persist().get(/\/dsad2.*/)
    interceptor2.reply(202, '2')

    const req1 = new http.ClientRequest({
      host: 'example.test',
      path: '/dsad1?foo=bar',
    })

    req1.end()

    await new Promise((resolve) => {
      req1.on('response', resolve)
    })

    const req2 = new http.ClientRequest({
      host: 'example.test',
      path: '/dsad1?foo=qux',
    })

    req2.end()

    await new Promise((resolve) => {
      req2.on('response', resolve)
    })

    expect(interceptor1.requests).to.have.lengthOf(2);
    expect(interceptor1.requests[0].path).to.equal('/dsad1?foo=bar')
    expect(interceptor1.requests[1].path).to.equal('/dsad1?foo=qux')
    expect(interceptor2.requests).to.be.empty;
  })
})
