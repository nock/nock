'use strict'

const { expect } = require('chai')
const http = require('http')
const sinon = require('sinon')
const { test } = require('tap')

const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

function ignore() {}

test('emits request and replied events when request has no body', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const onRequest = sinon.spy()
  const onReplied = sinon.spy()

  scope.on('request', onRequest);
  scope.on('replied', onReplied);

  await got('http://example.test')

  scope.done()
  expect(onRequest).to.have.been.calledOnce()
  expect(onReplied).to.have.been.calledOnce()
})

test('emits request and request body', async () => {
  const data = 'example=123'

  const scope = nock('http://example.test')
    .post('/please')
    .reply()

   const onRequest = sinon.spy()
   const onReplied = sinon.spy()

  scope.on('request', function(req, interceptor, body) {
    onRequest()
    expect(req.path).to.equal('/please')
    expect(interceptor.interceptionCounter).to.equal(0)
    expect(body).to.deep.equal(data)
    expect(onReplied).to.not.have.been.called()
  })

  scope.on('replied', function(req, interceptor) {
    onReplied()
    expect(req.path).to.equal('/please')
    expect(interceptor.interceptionCounter).to.equal(1)
  })

  await got.post('http://example.test/please', {
    body: data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data),
    }
  })

  scope.done()
  expect(onRequest).to.have.been.calledOnce()
  expect(onReplied).to.have.been.calledOnce()
})

test('emits no match when no match and no mock', function(t) {
  nock.emitter.once('no match', function() {
    t.end()
  })

  const req = http.get('http://example.test/abc')
  req.once('error', ignore)
})

test('emits no match when no match and mocked', function(t) {
  nock('http://example.test')
    .get('/')
    .reply(418)

  const assertion = function(req) {
    expect(req.path).to.equal('/definitelymaybe')
    nock.emitter.removeAllListeners('no match')
    t.end()
  }
  nock.emitter.on('no match', assertion)

  http.get('http://example.test/definitelymaybe').once('error', ignore)
})

test('emits no match when netConnect is disabled', function(t) {
  nock.disableNetConnect()
  nock.emitter.on('no match', function(req) {
    expect(req.hostname).to.equal('example.test')
    nock.emitter.removeAllListeners('no match')
    t.end()
  })
  http.get('http://example.test').once('error', ignore)
})
