'use strict'

const http = require('http')
const { expect } = require('chai')
const nock = require('..')
const sinon = require('sinon')
const assertRejects = require('assert-rejects')

const got = require('./got_client')
const servers = require('./servers')

describe('Nock lifecycle functions', () => {
  describe('`activate()`', () => {
    it('double activation throws exception', () => {
      nock.restore()
      expect(nock.isActive()).to.be.false()

      nock.activate()
      expect(nock.isActive()).to.be.true()

      expect(() => nock.activate()).to.throw(Error, 'Nock already active')

      expect(nock.isActive()).to.be.true()
    })

    it('(re-)activate after restore', async () => {
      const onResponse = sinon.spy()

      const { origin } = await servers.startHttpServer((request, response) => {
        onResponse()

        if (request.url === '/') {
          response.writeHead(200)
          response.write('server served a response')
        }

        response.end()
      })

      const scope = nock(origin).get('/').reply(304, 'served from our mock')

      nock.restore()
      expect(nock.isActive()).to.be.false()

      expect(await got(origin)).to.include({ statusCode: 200 })

      expect(scope.isDone()).to.be.false()

      nock.activate()
      expect(nock.isActive()).to.be.true()

      expect(await got(origin)).to.include({ statusCode: 304 })

      expect(scope.isDone()).to.be.true()

      expect(onResponse).to.have.been.calledOnce()
    })
  })

  describe('`cleanAll()`', () => {
    it('removes a half-consumed mock', async () => {
      nock('http://example.test').get('/').twice().reply()

      await got('http://example.test/')

      nock.cleanAll()

      await assertRejects(got('http://example.test/'), err => {
        expect(err).to.include({ name: 'RequestError', code: 'ENOTFOUND' })
        return true
      })
    })

    it('removes pending mocks from all scopes', () => {
      const scope1 = nock('http://example.test')
        .get('/somepath')
        .reply(200, 'hey')
      expect(scope1.pendingMocks()).to.deep.equal([
        'GET http://example.test:80/somepath',
      ])
      const scope2 = nock('http://example.test')
        .get('/somepath')
        .reply(200, 'hey')
      expect(scope2.pendingMocks()).to.deep.equal([
        'GET http://example.test:80/somepath',
      ])

      nock.cleanAll()

      expect(scope1.pendingMocks()).to.be.empty()
      expect(scope2.pendingMocks()).to.be.empty()
    })

    it('removes persistent mocks', async () => {
      nock('http://example.test').persist().get('/').reply()

      nock.cleanAll()

      await assertRejects(got('http://example.test/'), err => {
        expect(err).to.include({
          name: 'RequestError',
          code: 'ENOTFOUND',
        })
        return true
      })
    })

    it('should be safe to call in the middle of a request', done => {
      // This covers a race-condition where cleanAll() is called while a request
      // is in mid-flight. The request itself should continue to process normally.
      // Notably, `cleanAll` is being called before the Interceptor is marked as
      // consumed and removed from the global map. Having this test wait until the
      // response event means we verify it didn't throw an error when attempting
      // to remove an Interceptor that doesn't exist in the global map `allInterceptors`.
      nock('http://example.test').get('/').reply()

      const req = http.request('http://example.test', () => {
        done()
      })
      req.once('socket', () => {
        nock.cleanAll()
      })

      req.end()
    })
  })

  describe('`isDone()`', () => {
    it('returns false while a mock is pending, and true after it is consumed', async () => {
      const scope = nock('http://example.test').get('/').reply()

      expect(nock.isDone()).to.be.false()

      await got('http://example.test/')

      expect(nock.isDone()).to.be.true()

      scope.done()
    })
  })

  describe('`pendingMocks()`', () => {
    it('returns the expected array while a mock is pending, and an empty array after it is consumed', async () => {
      nock('http://example.test').get('/').reply()

      expect(nock.pendingMocks()).to.deep.equal(['GET http://example.test:80/'])

      await got('http://example.test/')

      expect(nock.pendingMocks()).to.be.empty()
    })
  })

  describe('`activeMocks()`', () => {
    it('returns the expected array for incomplete mocks', () => {
      nock('http://example.test').get('/').reply(200)
      expect(nock.activeMocks()).to.deep.equal(['GET http://example.test:80/'])
    })

    it("activeMocks doesn't return completed mocks", async () => {
      nock('http://example.test').get('/').reply()

      await got('http://example.test/')
      expect(nock.activeMocks()).to.be.empty()
    })
  })

  describe('resetting nock catastrophically while a request is in progress', () => {
    it('is handled gracefully', async () => {
      // While invoking cleanAll() from a nock request handler isn't very
      // realistic, it's possible that user code under test could crash, causing
      // before or after hooks to fire, which invoke `nock.cleanAll()`. A little
      // extreme, though if this does happen, we may as well be graceful about it.
      function somethingBad() {
        nock.cleanAll()
      }

      const responseBody = 'hi'
      const scope = nock('http://example.test')
        .get('/somepath')
        .reply(200, (uri, requestBody) => {
          somethingBad()
          return responseBody
        })

      const { body } = await got('http://example.test/somepath')

      expect(body).to.equal(responseBody)
      scope.done()
    })
  })

  describe('`abortPendingRequests()`', () => {
    it('prevents the request from completing', done => {
      const onRequest = sinon.spy()

      nock('http://example.test').get('/').delayConnection(100).reply(200, 'OK')

      http.get('http://example.test', onRequest)

      setTimeout(() => {
        expect(onRequest).not.to.have.been.called()
        done()
      }, 200)
      process.nextTick(nock.abortPendingRequests)
    })
  })
})
