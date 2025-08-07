'use strict'

const { expect } = require('chai')
const http = require('node:http')
const path = require('node:path')
const sinon = require('sinon')

const nock = require('../..')
const got = require('./got_client')

function ignore() {}

it('emits request and replied events when request has no body', async () => {
  const scope = nock('http://example.test').get('/').reply()

  const onRequest = sinon.spy()
  const onReplied = sinon.spy()

  scope.on('request', onRequest)
  scope.on('replied', onReplied)

  await got('http://example.test')

  scope.done()
  expect(onRequest).to.have.been.calledOnce()
  expect(onReplied).to.have.been.calledOnce()
})

it('emits request and request body', async () => {
  const data = 'example=123'

  const scope = nock('http://example.test').post('/please').reply()

  const onRequest = sinon.spy()
  const onReplied = sinon.spy()

  scope.on('request', function (req, interceptor, body) {
    onRequest()
    expect(new URL(req.url).pathname).to.equal('/please')
    expect(interceptor.interceptionCounter).to.equal(1)
    expect(body).to.deep.equal(data)
    expect(onReplied).to.not.have.been.called()
  })

  scope.on('replied', function (req, interceptor) {
    onReplied()
    expect(new URL(req.url).pathname).to.equal('/please')
    expect(interceptor.interceptionCounter).to.equal(1)
  })

  await got.post('http://example.test/please', {
    body: data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data),
    },
  })

  scope.done()
  expect(onRequest).to.have.been.calledOnce()
  expect(onReplied).to.have.been.calledOnce()
})

it('emits request and replied events when response body is a stream', async () => {
  const textFilePath = path.resolve(__dirname, '../assets/reply_file_1.txt')
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(200, textFilePath)

  const onRequest = sinon.spy()
  const onReplied = sinon.spy()

  scope.on('request', onRequest)
  scope.on('replied', onReplied)

  await got('http://example.test')

  scope.done()
  expect(onRequest).to.have.been.calledOnce()
  expect(onReplied).to.have.been.calledOnce()
})

describe('no match event', () => {
  it('emits no match when no match and no mock', done => {
    nock.emitter.once('no match', () => {
      done()
    })

    http.get('http://example.test/abc').once('error', ignore)
  })

  describe('mocked requests', () => {
    it('emits no match because of path mismatch', done => {
      const interceptor = nock('http://example.test').get('/')
      interceptor.reply(418)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(new URL(req.url).pathname).to.equal('/definitelymaybe')
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(['Path mismatch: expected /, got /definitelymaybe'])
        done()
      })

      http.get('http://example.test/definitelymaybe')
    })

    it('emits no match because of path function mismatch', done => {
      const pathFunction = (path) => path.includes('expected')
      const interceptor = nock('http://example.test').get(pathFunction)
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(['Path function mismatch: expected function to return true for /something'])
        done()
      })

      http.get('http://example.test/something').once('error', ignore)
    })

    it('emits no match because of method mismatch', done => {
      const interceptor = nock('http://example.test').get('/')
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(['Method mismatch: expected GET, got POST'])
        done()
      })

      const postReq = http.request({
        hostname: 'example.test',
        path: '/',
        method: 'POST'
      })
      postReq.end()
    })

    it('emits no match because of body mismatch', done => {
      const interceptor = nock('http://example.test')
        .post('/', 'expected body')
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(['Body mismatch: expected "expected body", got actual body'])
        done()
      })

      const postReq = http.request({
        hostname: 'example.test',
        path: '/',
        method: 'POST'
      })
      postReq.on('error', ignore)
      postReq.write('actual body')
      postReq.end()
    })

    it('emits no match because of query mismatch', done => {
      const interceptor = nock('http://example.test')
        .get('/')
        .query({ foo: 'bar' })
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(['query matching failed'])
        done()
      })

      http.get('http://example.test/?foo=baz').once('error', ignore)
    })

    it('emits no match because of header mismatch', done => {
      const interceptor = nock('http://example.test')
        .matchHeader('x-scope', 'test-scope')
        .get('/')
        .matchHeader('x-interceptor', 'test-interceptor')
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal([
          'Header mismatch: expected x-scope to match test-scope, got null',
          'Header mismatch: expected x-interceptor to match test-interceptor, got null'
        ])
        done()
      })

      http.get('http://example.test/').once('error', ignore)
    })

    it('emits no match because of request headers mismatch', done => {
      const scope = nock('http://example.test', {
        reqheaders: {
          'x-required': 'value'
        }
      })
      const interceptor = scope.get('/')
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(["Request headers don't match"])
        done()
      })

      http.get('http://example.test/').once('error', ignore)
    })

    it('emits no match because of bad headers', done => {
      const scope = nock('http://example.test', {
        badheaders: ['x-forbidden']
      })
      const interceptor = scope.get('/')
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(['Request contains bad headers: x-forbidden'])
        done()
      })

      const req = http.request({
        hostname: 'example.test',
        path: '/',
        method: 'GET',
        headers: {
          'x-forbidden': 'should not be here'
        }
      })
      req.on('error', ignore)
      req.end()
    })

    it('emits no match because conditionally() failed', done => {
      const scope = nock('http://example.test', {
        conditionally: () => false
      })
      const interceptor = scope.get('/')
      interceptor.reply(200)

      nock.emitter.on('no match', (req, mismatches) => {
        expect(mismatches).to.have.lengthOf(1)
        expect(mismatches[0].interceptor).to.equal(interceptor)
        expect(mismatches[0].reasons).to.deep.equal(['conditionally() did not validate'])
        done()
      })

      http.get('http://example.test/').once('error', ignore)
    })
  });

  it('emits no match when netConnect is disabled', done => {
    nock.disableNetConnect()

    nock.emitter.on('no match', req => {
      expect(new URL(req.url).hostname).to.equal('example.test')
      done()
    })

    http.get('http://example.test').once('error', ignore)
  })
});