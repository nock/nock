'use strict'

const { expect } = require('chai')
const undici = require('undici')
const nock = require('..')
const { startHttpServer } = require('./servers')

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
  });

  it('query options overrides URL query', async () => {
    const scope = nock('http://example.test')
      .get('/test')
      .query({ a: 1 })
      .reply(200)

    await undici.request('http://example.test/test?a=2', {
      query: { a: 1 },
    })
    
    scope.done()
  });

  it('GET request with query in path', async () => {
    const scope = nock('http://example.test')
      .get('/test')
      .query({ a: 1 })
      .reply(200)

    await undici.request('http://example.test/test?a=1')

    scope.done()
  });

  it('POST request', async () => {
    let requestBody
    nock('http://example.test')
      .post('/test', body => (requestBody = body, true))
      .reply(200)
    const response = await undici.request('http://example.test/test', {
      method: 'POST',
      body: 'test',
    })
    
    expect(response.statusCode).to.be.eq(200) 
    expect(requestBody).to.be.eq('test')
  });

  it('forward request if no mock', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.write('live')
      response.end()
    })

    const { statusCode } = await undici.request(origin)
    expect(statusCode).to.equal(200)
  })
})
