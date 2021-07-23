'use strict'

// Tests for invoking `.reply()` with a synchronous function which return the
// response body or an array containing the status code and optional response
// body and headers.

const assertRejects = require('assert-rejects')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

describe('synchronous `reply()` function', () => {
  describe('when invoked with status code followed by function', () => {
    it('passes through a string', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(201, () => 'OK!')

      const { statusCode, body } = await got('http://example.test')
      expect(statusCode).to.equal(201)
      expect(body).to.be.a('string').and.to.equal('OK!')
      scope.done()
    })

    it('stringifies an object', async () => {
      const exampleResponse = { message: 'OK!' }

      const scope = nock('http://example.test')
        .get('/')
        .reply(201, () => exampleResponse)

      const { statusCode, body } = await got('http://example.test')
      expect(statusCode).to.equal(201)
      expect(body)
        .to.be.a('string')
        .and.to.equal(JSON.stringify(exampleResponse))
      scope.done()
    })

    it('stringifies a number', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(201, () => 123)

      const { statusCode, body } = await got('http://example.test')
      expect(statusCode).to.equal(201)
      expect(body).to.be.a('string').and.to.equal('123')
      scope.done()
    })

    it('stringifies an array', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(201, () => [123])

      const { statusCode, body } = await got('http://example.test')
      expect(statusCode).to.equal(201)
      expect(body).to.be.a('string').and.to.equal('[123]')
      scope.done()
    })

    it('stringifies a boolean', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(201, () => false)

      const { statusCode, body } = await got('http://example.test')
      expect(statusCode).to.equal(201)
      expect(body).to.be.a('string').and.to.equal('false')
      scope.done()
    })

    it('stringifies null', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(201, () => null)

      const { statusCode, body } = await got('http://example.test')
      expect(statusCode).to.equal(201)
      expect(body).to.be.a('string').and.to.equal('null')
      scope.done()
    })

    it("isn't invoked until request matches", async () => {
      const onReply = sinon.spy()

      const scope = nock('http://example.test')
        .get('/')
        .reply(200, (uri, body) => {
          onReply()
          return ''
        })

      expect(onReply).not.to.have.been.called()
      await got('http://example.test/')
      expect(onReply).to.have.been.calledOnce()

      scope.done()
    })

    context('when the request has a string body', () => {
      it('passes through a string', async () => {
        const exampleRequestBody = 'key=val'
        const exampleResponseBody = 'foo'

        const scope = nock('http://example.test')
          .post('/endpoint', exampleRequestBody)
          .reply(404, () => exampleResponseBody)

        await assertRejects(
          got.post('http://example.test/endpoint', {
            body: exampleRequestBody,
          }),
          ({ response: { statusCode, body } }) => {
            expect(statusCode).to.equal(404)
            expect(body).to.equal(exampleResponseBody)
            return true
          }
        )
        scope.done()
      })
    })

    describe('the reply function arguments', () => {
      context('when the request has a non-JSON string', () => {
        it('receives the URL and body', async () => {
          const exampleRequestBody = 'key=val'
          const replyFnCalled = sinon.spy()

          const scope = nock('http://example.test')
            .post('/endpoint', exampleRequestBody)
            .reply(404, (uri, requestBody) => {
              replyFnCalled()
              expect(uri).to.equal('/endpoint')
              expect(requestBody).to.equal(exampleRequestBody)
            })

          await assertRejects(
            got.post('http://example.test/endpoint', {
              body: exampleRequestBody,
            }),
            ({ response: { statusCode, body } }) => {
              expect(statusCode).to.equal(404)
              expect(body).to.equal('')
              return true
            }
          )

          expect(replyFnCalled).to.have.been.called()
          scope.done()
        })
      })

      context('when the request has a JSON string', () => {
        it('when content-type is json, receives the parsed body', async () => {
          const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })
          const replyFnCalled = sinon.spy()

          const scope = nock('http://example.test')
            .post('/')
            .reply(201, (uri, requestBody) => {
              replyFnCalled()
              expect(requestBody)
                .to.be.an('object')
                .and.to.deep.equal(JSON.parse(exampleRequestBody))
            })

          const { statusCode } = await got.post('http://example.test/', {
            headers: { 'Content-Type': 'application/json' },
            body: exampleRequestBody,
          })
          expect(replyFnCalled).to.have.been.called()
          expect(statusCode).to.equal(201)
          scope.done()
        })

        // Regression test for https://github.com/nock/nock/issues/1642
        it('when content-type is json (as array), receives the parsed body', async () => {
          const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })
          const replyFnCalled = sinon.spy()

          const scope = nock('http://example.test')
            .post('/')
            .reply(201, (uri, requestBody) => {
              replyFnCalled()
              expect(requestBody)
                .to.be.an('object')
                .and.to.to.deep.equal(JSON.parse(exampleRequestBody))
            })

          const { statusCode } = await got.post('http://example.test/', {
            // Providing the field value as an array is probably a bug on the callers behalf,
            // but it is still allowed by Node
            headers: { 'Content-Type': ['application/json', 'charset=utf8'] },
            body: exampleRequestBody,
          })
          expect(replyFnCalled).to.have.been.called()
          expect(statusCode).to.equal(201)
          scope.done()
        })

        it('without content-type header, receives the body as string', async () => {
          const exampleRequestBody = JSON.stringify({ id: 1, name: 'bob' })
          const replyFnCalled = sinon.spy()

          const scope = nock('http://example.test')
            .post('/')
            .reply(201, (uri, requestBody) => {
              replyFnCalled()
              expect(requestBody)
                .to.be.a('string')
                .and.to.equal(exampleRequestBody)
            })

          const { statusCode } = await got.post('http://example.test/', {
            body: exampleRequestBody,
          })
          expect(replyFnCalled).to.have.been.called()
          expect(statusCode).to.equal(201)
          scope.done()
        })
      })
    })
  })

  // This signature is supported today, however it seems unnecessary. This is
  // just as easily accomplished with a function returning an array:
  // `.reply(() => [201, 'ABC', { 'X-My-Headers': 'My custom header value' }])`
  it('invoked with status code, function returning array, and headers', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .reply(201, () => 'ABC', { 'X-My-Headers': 'My custom header value' })

    const { headers } = await got('http://example.test/')

    expect(headers).to.deep.equal({ 'x-my-headers': 'My custom header value' })

    scope.done()
  })

  describe('when invoked with function returning array', () => {
    it('handles status code alone', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [202])

      const { statusCode, body } = await got('http://example.test/')

      expect(statusCode).to.equal(202)
      expect(body).to.equal('')
      scope.done()
    })

    it('handles status code and string body', async () => {
      const exampleResponse = 'This is a body'
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [401, exampleResponse])

      await assertRejects(
        got('http://example.test/'),
        ({ response: { statusCode, body } }) => {
          expect(statusCode).to.equal(401)
          expect(body).to.equal(exampleResponse)
          return true
        }
      )
      scope.done()
    })

    it('handles status code and body object', async () => {
      const exampleResponse = { message: 'OK!' }

      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [202, exampleResponse])

      const { statusCode, body } = await got('http://example.test/')

      expect(statusCode).to.equal(202)
      expect(body).to.equal(JSON.stringify(exampleResponse))
      scope.done()
    })

    it('handles status code and body as number', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [202, 123])

      const { statusCode, body } = await got('http://example.test/')

      expect(statusCode).to.equal(202)
      expect(body).to.be.a('string').and.to.to.equal('123')
      scope.done()
    })

    it('handles status code, string body, and headers object', async () => {
      const exampleBody = 'this is the body'
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [
          202,
          exampleBody,
          { 'x-key': 'value', 'x-key-2': 'value 2' },
        ])

      const { statusCode, body, headers, rawHeaders } = await got(
        'http://example.test/'
      )

      expect(statusCode).to.equal(202)
      expect(body).to.equal(exampleBody)
      expect(headers).to.deep.equal({
        'x-key': 'value',
        'x-key-2': 'value 2',
      })
      expect(rawHeaders).to.deep.equal(['x-key', 'value', 'x-key-2', 'value 2'])
      scope.done()
    })

    it('handles status code, object body, and headers object', async () => {
      const exampleBody = { foo: 'bar' }
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [
          202,
          exampleBody,
          { 'x-key': 'value', 'x-key-2': 'value 2' },
        ])

      const { statusCode, body, headers, rawHeaders } = await got(
        'http://example.test/'
      )

      expect(statusCode).to.equal(202)
      expect(body).to.equal(JSON.stringify(exampleBody))
      expect(headers).to.deep.equal({
        'content-type': 'application/json',
        'x-key': 'value',
        'x-key-2': 'value 2',
      })
      expect(rawHeaders).to.deep.equal([
        'x-key',
        'value',
        'x-key-2',
        'value 2',
        'Content-Type',
        'application/json',
      ])
      scope.done()
    })

    it('when given a non-array, raises the expected error', async () => {
      nock('http://example.test')
        .get('/abc')
        .reply(() => 'ABC')

      await assertRejects(got('http://example.test/abc'), err => {
        expect(err).to.be.an.instanceOf(Error).and.include({
          message: 'A single function provided to .reply MUST return an array',
        })
        return true
      })
    })

    it('when given an empty array, raises the expected error', async () => {
      nock('http://example.test')
        .get('/abc')
        .reply(() => [])

      await assertRejects(got('http://example.test/abc'), err => {
        expect(err).to.be.an.instanceOf(Error).and.include({
          message: 'Invalid undefined value for status code',
        })
        return true
      })
    })

    it('when given an array with too many entries, raises the expected error', async () => {
      nock('http://example.test')
        .get('/abc')
        .reply(() => [
          'user',
          'probably',
          'intended',
          'this',
          'to',
          'be',
          'JSON',
        ])

      await assertRejects(got('http://example.test/abc'), err => {
        expect(err).to.be.an.instanceOf(Error).and.include({
          message:
            'The array returned from the .reply callback contains too many values',
        })
        return true
      })
    })

    it('when given extraneous arguments, raises the expected error', () => {
      const interceptor = nock('http://example.test').get('/')

      expect(() =>
        interceptor.reply(() => [200], { 'x-my-header': 'some-value' })
      ).to.throw(Error, 'Invalid arguments')
    })
  })
})
