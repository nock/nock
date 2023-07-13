'use strict'

const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

describe('`removeInterceptor()`', () => {
  context('when invoked with an Interceptor instance', () => {
    it('remove interceptor removes given interceptor', async () => {
      const newScope = nock('http://example.test')
        .get('/somepath')
        .reply(202, 'other-content')
      const givenInterceptor = nock('http://example.test').get('/somepath')
      givenInterceptor.reply(200, 'hey')

      expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

      const { statusCode, body } = await got('http://example.test/somepath')

      expect(statusCode).to.equal(202)
      expect(body).to.equal('other-content')

      newScope.done()
    })

    it('reflects the removal in `pendingMocks()`', () => {
      const givenInterceptor = nock('http://example.test').get('/somepath')
      const scope = givenInterceptor.reply(200, 'hey')

      expect(scope.pendingMocks()).to.deep.equal([
        'GET http://example.test:80/somepath',
      ])

      expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

      expect(scope.pendingMocks()).to.deep.equal([])
    })

    it('removes given interceptor for https', async () => {
      const givenInterceptor = nock('https://example.test').get('/somepath')
      const scope = givenInterceptor.reply(200, 'hey')

      expect(scope.pendingMocks()).to.deep.equal([
        'GET https://example.test:443/somepath',
      ])

      expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

      const newScope = nock('https://example.test')
        .get('/somepath')
        .reply(202, 'other-content')

      const { statusCode, body } = await got('https://example.test/somepath')

      expect(statusCode).to.equal(202)
      expect(body).to.equal('other-content')

      newScope.done()
    })

    it('works on an interceptor with a regex for a path', async () => {
      const givenInterceptor = nock('http://example.test').get(/somePath$/)
      const scope = givenInterceptor.reply(200, 'hey')

      expect(scope.pendingMocks()).to.deep.equal([
        'GET http://example.test:80//somePath$/',
      ])

      expect(nock.removeInterceptor(givenInterceptor)).to.be.true()

      const newScope = nock('http://example.test')
        .get(/somePath$/)
        .reply(202, 'other-content')

      const { statusCode, body } = await got('http://example.test/get-somePath')

      expect(statusCode).to.equal(202)
      expect(body).to.equal('other-content')

      newScope.done()
    })
  })

  context('when invoked with an object', () => {
    it('removes a matching interceptor and returns true', async () => {
      nock('http://example.test').get('/somepath').reply(200, 'hey')

      expect(
        nock.removeInterceptor({
          hostname: 'example.test',
          path: '/somepath',
        })
      ).to.be.true()

      const newScope = nock('http://example.test')
        .get('/somepath')
        .reply(202, 'other-content')

      const { statusCode, body } = await got('http://example.test/somepath')

      expect(statusCode).to.equal(202)
      expect(body).to.equal('other-content')

      newScope.done()
    })

    it('when no interceptor is found, returns false', () => {
      expect(
        nock.removeInterceptor({
          hostname: 'example.org',
          path: '/somepath',
        })
      ).to.be.false()
    })

    it('can match a request with a proto', () => {
      const scope = nock('https://example.test')
        .get('/somepath')
        .reply(200, 'hey')
      expect(scope.pendingMocks()).to.deep.equal([
        'GET https://example.test:443/somepath',
      ])

      expect(
        nock.removeInterceptor({
          proto: 'https',
          hostname: 'example.test',
          path: '/somepath',
        })
      ).to.be.true()

      expect(scope.pendingMocks()).to.deep.equal([])
    })

    it('can match a request with a method', () => {
      const scope = nock('http://example.test')
        .post('/somepath')
        .reply(200, 'hey')
      expect(scope.pendingMocks()).to.deep.equal([
        'POST http://example.test:80/somepath',
      ])

      expect(
        nock.removeInterceptor({
          method: 'post',
          hostname: 'example.test',
          path: '/somepath',
        })
      ).to.be.true()

      expect(scope.pendingMocks()).to.deep.equal([])
    })

    it('can match the default path `/` when no path is specified', () => {
      const scope = nock('http://example.test').get('/').reply(200, 'hey')
      expect(scope.pendingMocks()).to.deep.equal([
        'GET http://example.test:80/',
      ])

      expect(
        nock.removeInterceptor({
          hostname: 'example.test',
        })
      ).to.be.true()

      expect(scope.pendingMocks()).to.deep.equal([])
    })

    it('only removes interceptors whose path matches', () => {
      const scope1 = nock('http://example.test')
        .get('/somepath')
        .reply(200, 'hey')
      const scope2 = nock('http://example.test')
        .get('/anotherpath')
        .reply(200, 'hey')

      expect(scope1.pendingMocks()).to.deep.equal([
        'GET http://example.test:80/somepath',
      ])
      expect(scope2.pendingMocks()).to.deep.equal([
        'GET http://example.test:80/anotherpath',
      ])

      expect(
        nock.removeInterceptor({
          hostname: 'example.test',
          path: '/anotherpath',
        })
      ).to.be.true()

      expect(scope1.pendingMocks()).to.deep.equal([
        'GET http://example.test:80/somepath',
      ])
      expect(scope2.pendingMocks()).to.deep.equal([])
    })
  })
})
