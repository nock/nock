import { expect } from 'chai'
import http from 'node:http'
import sinon from 'sinon'
import nock from '../index.ts'

import { startHttpServer } from './servers/index.js'

// Because `Got` makes use of the `http(s).request` convenience function, it can not be used during these tests.
describe('Direct use of `ClientRequest`', () => {
  it('should intercept GET requests', done => {
    const dataSpy = sinon.spy()

    const scope = nock('http://example.test').get('/dsad').reply(202, 'HEHE!')

    const req = new http.ClientRequest({
      host: 'example.test',
      path: '/dsad',
    })

    req.on('response', function (res) {
      expect(res.statusCode).to.equal(202)
      res.on('end', function () {
        expect(dataSpy).to.have.been.calledOnce()
        scope.done()
        done()
      })
      res.on('data', function (data) {
        dataSpy()
        expect(data).to.be.instanceof(Buffer)
        expect(data.toString()).to.equal('HEHE!')
      })
    })

    req.end()
  })

  it('should intercept POST requests', done => {
    const dataSpy = sinon.spy()

    const scope = nock('http://example.test')
      .post('/posthere/please', 'heyhey this is the body')
      .reply(201, 'DOOONE!')

    const req = new http.ClientRequest({
      host: 'example.test',
      path: '/posthere/please',
      method: 'POST',
    })
    req.write('heyhey this is the body')

    req.on('response', function (res) {
      expect(res.statusCode).to.equal(201)
      res.on('end', function () {
        expect(dataSpy).to.have.been.calledOnce()
        scope.done()
        done()
      })
      res.on('data', function (data) {
        dataSpy()
        expect(data).to.be.instanceof(Buffer)
        expect(data.toString()).to.equal('DOOONE!')
      })
    })

    req.end()
  })

  it('should execute optional callback', done => {
    const scope = nock('http://example.test').get('/').reply(201)

    const reqOpts = {
      host: 'example.test',
      path: '/',
      method: 'GET',
    }
    const req = new http.ClientRequest(reqOpts, res => {
      expect(res.statusCode).to.equal(201)
      scope.done()
      done()
    })
    req.end()
  })

  it('should emit the timeout event before the response when delayed beyond the request timeout', done => {
    // Regression test for https://github.com/nock/nock/issues/2919:
    // `delay()` must also apply to responses without a body (e.g. 204, 205),
    // otherwise the response is delivered immediately and the request-level
    // timeout (`timeout` option or `ClientRequest#setTimeout()`) can never
    // fire first.
    const scope = nock('http://example.test')
      .get('/')
      .delay(500)
      .reply(204)

    const req = http.request('http://example.test', { timeout: 100 })

    const onTimeout = () => {
      req.destroy(new Error('Request timed out successfully'))
    }
    req.on('timeout', onTimeout)
    req.on('error', err => {
      req.off('timeout', onTimeout)
      expect(err.message).to.equal('Request timed out successfully')
      scope.isDone()
      done()
    })
    // If the response arrives before the timeout, the delay was not applied.
    req.on('response', () => {
      req.off('timeout', onTimeout)
      done(new Error('response arrived before the timeout event'))
    })

    req.end()
  })

  it('should pass thru a live request when no interceptors and net connect is allowed', async () => {
    const { origin } = await startHttpServer((request, response) => {
      response.writeHead(201)
      response.end()
    })

    const req = new http.ClientRequest(origin)

    await new Promise(resolve => {
      req.on('response', res => {
        expect(res.statusCode).to.equal(201)
        resolve()
      })
      req.end()
    })
  })

  it('should emit an expected error when no interceptors and net connect is disallowed', done => {
    nock.disableNetConnect()
    const req = new http.ClientRequest({ port: 12345, path: '/' }).on(
      'error',
      err => {
        expect(err.message).to.equal(
          'Nock: Disallowed net connect for "localhost:12345/"',
        )
        done()
      },
    )
    req.end()
  })
})
