'use strict'

const { expect } = require('chai')
const nock = require('..')
const assertRejects = require('assert-rejects')
const { startHttpServer } = require('./servers')

if (global.fetch) {
  describe('Native Fetch', () => {
    it('input is string', async () => {
      const scope = nock('http://example.test').get('/').reply()

      const { status } = await fetch('http://example.test/')
      expect(status).to.equal(200)
      scope.done()
    })

    it('input is URL', async () => {
      const scope = nock('http://example.test').get('/').reply()

      const { status } = await fetch(new URL('http://example.test/'))
      expect(status).to.equal(200)
      scope.done()
    })

    it('input is Request object', async () => {
      const scope = nock('http://example.test').get('/').reply()

      const { status } = await fetch(new Request('http://example.test/'))
      expect(status).to.equal(200)
      scope.done()
    })

    it('filter by body', async () => {
      const scope = nock('http://example.test')
        .post('/', { test: 'fetch' })
        .reply()

      const { status } = await fetch('http://example.test/', {
        method: 'POST',
        body: JSON.stringify({ test: 'fetch' }),
      })
      expect(status).to.equal(200)
      scope.done()
    })

    it('filter by request body', async () => {
      const scope = nock('http://example.test')
        .post('/', { test: 'fetch' })
        .reply()

      const { status } = await fetch(
        new Request('http://example.test/', {
          method: 'POST',
          body: JSON.stringify({ test: 'fetch' }),
        }),
      )
      expect(status).to.equal(200)
      scope.done()
    })

    it('no match', async () => {
      nock('http://example.test').get('/').reply()

      await assertRejects(
        fetch('http://example.test/wrong-path'),
        /Nock: No match for request/,
      )
    })

    it('forward request if no mock', async () => {
      const { origin } = await startHttpServer((request, response) => {
        response.write('live')
        response.end()
      })

      const { status } = await fetch(origin)
      expect(status).to.equal(200)
    })

    it('should work with empty response', async () => {
      nock('http://example.test').get('/').reply(204)

      const { status } = await fetch('http://example.test')
      expect(status).to.equal(204)
    })

    it('should work https', async () => {
      nock('https://example.test').get('/').reply()

      const { status } = await fetch('https://example.test')
      expect(status).to.equal(200)
    })
  })
}
