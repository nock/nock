'use strict'

const { expect } = require('chai')
const http = require('http')
const path = require('path')
const sinon = require('sinon')

const nock = require('..')
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
    expect(req.path).to.equal('/please')
    expect(interceptor.interceptionCounter).to.equal(1)
    expect(body).to.deep.equal(data)
    expect(onReplied).to.not.have.been.called()
  })

  scope.on('replied', function (req, interceptor) {
    onReplied()
    expect(req.path).to.equal('/please')
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
  const textFilePath = path.resolve(__dirname, './assets/reply_file_1.txt')
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

it('emits no match when no match and no mock', done => {
  nock.emitter.once('no match', () => {
    done()
  })

  http.get('http://example.test/abc').once('error', ignore)
})

it('emits no match when no match and mocked', done => {
  nock('http://example.test').get('/').reply(418)

  nock.emitter.on('no match', req => {
    expect(req.path).to.equal('/definitelymaybe')
    done()
  })

  http.get('http://example.test/definitelymaybe').once('error', ignore)
})

it('emits no match when netConnect is disabled', done => {
  nock.disableNetConnect()

  nock.emitter.on('no match', req => {
    expect(req.hostname).to.equal('example.test')
    done()
  })

  http.get('http://example.test').once('error', ignore)
})
