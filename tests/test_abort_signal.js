'use strict'

const { expect } = require('chai')
const http = require('http')
const nock = require('..')

// These tests use `AbortSignal` to abort HTTP requests

const makeRequest = async (url, options = {}) => {
  const { statusCode } = await new Promise((resolve, reject) => {
    http
      .request(url, options)
      .on('response', res => {
        res
          .on('data', () => {})
          .on('error', reject)
          .on('end', () => resolve({ statusCode: res.statusCode }))
      })
      .on('error', reject)
      .end()
  })

  return { statusCode }
}

describe('When `AbortSignal` is used', () => {
  it('does not abort a request if the signal is not aborted', async () => {
    const abortController = new AbortController()

    const scope = nock('http://example.test').post('/form').reply(201, 'OK!')

    const { statusCode } = await makeRequest('http://example.test/form', {
      method: 'POST',
      signal: abortController.signal,
    })

    expect(statusCode).to.equal(201)
    scope.done()
  })

  it('aborts a request if the signal is aborted before the request is made', async () => {
    const abortController = new AbortController()
    abortController.abort()

    const scope = nock('http://example.test').post('/form').reply(201, 'OK!')

    const error = await makeRequest('http://example.test/form', {
      method: 'POST',
      signal: abortController.signal,
    }).catch(error => error)

    expect(error).to.have.property('message', 'The operation was aborted')
    expect(error).to.have.property('name', 'AbortError')
    expect(error).to.have.property('code', 'ABORT_ERR')
    expect(error.cause).to.have.property(
      'message',
      'This operation was aborted',
    )
    expect(scope.isDone()).to.be.false()
  })

  it('sets the reason correctly for an aborted request', async () => {
    const abortController = new AbortController()
    const cause = new Error('A very good reason')
    abortController.abort(cause)

    const scope = nock('http://example.test').post('/form').reply(201, 'OK!')

    const error = await makeRequest('http://example.test/form', {
      method: 'POST',
      signal: abortController.signal,
    }).catch(error => error)

    expect(error).to.have.property('message', 'The operation was aborted')
    expect(error).to.have.property('name', 'AbortError')
    expect(error).to.have.property('code', 'ABORT_ERR')
    expect(error.cause).to.eql(cause)
    expect(scope.isDone()).to.be.false()
  })

  it('aborts a request if the signal is aborted after the response headers have been read', async () => {
    const abortController = new AbortController()
    const scope = nock('http://example.test').post('/form').reply(201, 'OK!')

    const makeRequest = () =>
      new Promise((resolve, reject) => {
        http
          .request('http://example.test/form', {
            signal: abortController.signal,
            method: 'POST',
          })
          .on('response', res => {
            abortController.abort()
            res
              .on('data', () => {})
              .on('error', error => {
                reject(error)
              })
              .on('end', () =>
                resolve({
                  statusCode: res.statusCode,
                }),
              )
          })
          .on('error', error => {
            reject(error)
          })
          .end()
      })

    const error = await makeRequest().catch(error => error)
    expect(error).to.have.property('message', 'The operation was aborted')
    expect(error).to.have.property('name', 'AbortError')
    expect(error).to.have.property('code', 'ABORT_ERR')
    expect(error.cause).to.have.property(
      'message',
      'This operation was aborted',
    )
    scope.done()
  })

  it('aborts a request if the signal is aborted before the connection is made', async () => {
    const signal = AbortSignal.timeout(10)
    const scope = nock('http://example.test')
      .post('/form')
      .delayConnection(10)
      .reply(201, 'OK!')

    const error = await makeRequest('http://example.test/form', {
      signal,
      method: 'POST',
    }).catch(error => error)

    expect(error).to.have.property('message', 'The operation was aborted')
    expect(error).to.have.property('name', 'AbortError')
    expect(error).to.have.property('code', 'ABORT_ERR')
    expect(error.cause).to.have.property('name', 'TimeoutError')
    scope.done()
  })

  it('aborts a request if the signal is aborted before the body is returned', async () => {
    const signal = AbortSignal.timeout(10)
    const scope = nock('http://example.test')
      .post('/form')
      .delay(10)
      .reply(201, 'OK!')

    const error = await makeRequest('http://example.test/form', {
      signal,
      method: 'POST',
    }).catch(error => error)

    expect(error).to.have.property('message', 'The operation was aborted')
    expect(error).to.have.property('name', 'AbortError')
    expect(error).to.have.property('code', 'ABORT_ERR')
    expect(error.cause).to.have.property('name', 'TimeoutError')

    scope.done()
  })

  it('does not abort a request if the signal is aborted after the request has been completed', done => {
    const signal = AbortSignal.timeout(30)
    signal.addEventListener('abort', () => done())

    const scope = nock('http://example.test').post('/form').reply(201, 'OK!')

    makeRequest('http://example.test/form', {
      signal,
      method: 'POST',
    })
      .then(({ statusCode }) => {
        expect(statusCode).to.equal(201)
        scope.done()
      })
      .catch(error => done(error))
  })
})
