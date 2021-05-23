'use strict'

// Tests for invoking `.reply()` with a function which invokes the error-first
// callback with the response body or an array containing the status code and
// optional response body and headers.

const { expect } = require('chai')
const assertRejects = require('assert-rejects')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

describe('asynchronous `reply()` function', () => {
  describe('using callback', () => {
    it('reply can take a callback', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(200, (path, requestBody, callback) =>
          callback(null, 'Hello World!')
        )

      const { body } = await got('http://example.test/', {
        responseType: 'buffer',
      })

      expect(body).to.be.an.instanceOf(Buffer)
      expect(body.toString('utf8')).to.equal('Hello World!')
      scope.done()
    })

    it('reply takes a callback for status code', async () => {
      const responseBody = 'Hello, world!'

      const scope = nock('http://example.test')
        .get('/')
        .reply((path, requestBody, callback) => {
          setTimeout(
            () =>
              callback(null, [
                202,
                responseBody,
                { 'X-Custom-Header': 'abcdef' },
              ]),
            1
          )
        })

      const { statusCode, headers, body } = await got('http://example.test/')

      expect(statusCode).to.equal(202)
      expect(headers).to.deep.equal({ 'x-custom-header': 'abcdef' })
      expect(body).to.equal(responseBody)
      scope.done()
    })

    it('should get request headers', async () => {
      const scope = nock('http://example.test')
        .get('/yo')
        .reply(201, function (path, reqBody, cb) {
          expect(this.req.path).to.equal('/yo')
          expect(this.req.headers).to.deep.equal({
            'accept-encoding': 'gzip, deflate, br',
            host: 'example.test',
            'x-my-header': 'some-value',
            'x-my-other-header': 'some-other-value',
            'user-agent': 'got (https://github.com/sindresorhus/got)',
          })
          setTimeout(function () {
            cb(null, 'foobar')
          }, 1e3)
        })

      const { statusCode, body } = await got('http://example.test/yo', {
        headers: {
          'x-my-header': 'some-value',
          'x-my-other-header': 'some-other-value',
        },
      })

      expect(statusCode).to.equal(201)
      expect(body).to.equal('foobar')

      scope.done()
    })

    it('reply should throw on error on the callback', async () => {
      nock('http://example.test')
        .get('/')
        .reply(500, (path, requestBody, callback) =>
          callback(new Error('Database failed'))
        )

      await assertRejects(got('http://example.test'), /Database failed/)
    })

    it('an error passed to the callback propagates when [err, fullResponseArray] is expected', async () => {
      nock('http://example.test')
        .get('/')
        .reply((path, requestBody, callback) => {
          callback(Error('boom'))
        })

      await assertRejects(got('http://example.test'), /boom/)
    })

    it('subsequent calls to the reply callback are ignored', async () => {
      const replyFnCalled = sinon.spy()

      const scope = nock('http://example.test')
        .get('/')
        .reply(201, (path, requestBody, callback) => {
          replyFnCalled()
          callback(null, 'one')
          callback(null, 'two')
          callback(new Error('three'))
        })

      const { statusCode, body } = await got('http://example.test/')

      expect(replyFnCalled).to.have.been.calledOnce()
      expect(statusCode).to.equal(201)
      expect(body).to.equal('one')

      scope.done()
    })
  })

  describe('using async/promises', () => {
    it('reply can take a status code with an 2-arg async function, and passes it the correct arguments', async () => {
      const scope = nock('http://example.com')
        .post('/foo')
        .reply(201, async (path, requestBody) => {
          expect(path).to.equal('/foo')
          expect(requestBody).to.equal('request-body')
          return 'response-body'
        })

      const { statusCode, body } = await got.post('http://example.com/foo', {
        body: 'request-body',
      })

      expect(statusCode).to.equal(201)
      expect(body).to.equal('response-body')
      scope.done()
    })

    it('reply can take a status code with a 0-arg async function, and passes it the correct arguments', async () => {
      const scope = nock('http://example.com')
        .get('/')
        .reply(async () => [201, 'Hello World!'])

      const { statusCode, body } = await got('http://example.com/')

      expect(statusCode).to.equal(201)
      expect(body).to.equal('Hello World!')
      scope.done()
    })

    it('when reply is called with a status code and an async function that throws, it propagates the error', async () => {
      nock('http://example.test')
        .get('/')
        .reply(201, async () => {
          throw Error('oh no!')
        })

      await assertRejects(got('http://example.test'), /oh no!/)
    })

    it('when reply is called with an async function that throws, it propagates the error', async () => {
      nock('http://example.test')
        .get('/')
        .reply(async () => {
          throw Error('oh no!')
        })

      await assertRejects(got('http://example.test'), /oh no!/)
    })
  })
})
