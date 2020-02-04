'use strict'

const http = require('http')
const { test } = require('tap')
const { expect } = require('chai')
const nock = require('..')
const sinon = require('sinon')
const assertRejects = require('assert-rejects')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('double activation throws exception', t => {
  nock.restore()
  expect(nock.isActive()).to.be.false()

  nock.activate()
  expect(nock.isActive()).to.be.true()

  expect(() => nock.activate()).to.throw(Error, 'Nock already active')

  expect(nock.isActive()).to.be.true()

  t.end()
})

test('(re-)activate after restore', async t => {
  const onResponse = sinon.spy()

  const server = http.createServer((request, response) => {
    onResponse()

    if (request.url === '/') {
      response.writeHead(200)
      response.write('server served a response')
    }

    response.end()
  })

  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const url = `http://localhost:${server.address().port}`

  const scope = nock(url)
    .get('/')
    .reply(304, 'served from our mock')

  nock.restore()
  expect(nock.isActive()).to.be.false()

  expect(await got(url)).to.include({ statusCode: 200 })

  expect(scope.isDone()).to.be.false()

  nock.activate()
  expect(nock.isActive()).to.be.true()

  expect(await got(url)).to.include({ statusCode: 304 })

  expect(scope.isDone()).to.be.true()

  expect(onResponse).to.have.been.calledOnce()
})

test('clean all works', async t => {
  nock('http://example.test')
    .get('/')
    .twice()
    .reply()

  await got('http://example.test/')

  nock.cleanAll()

  await assertRejects(got('http://example.test/'), err => {
    expect(err).to.include({ name: 'RequestError', code: 'ENOTFOUND' })
    return true
  })
})

test('cleanAll should remove pending mocks from all scopes', t => {
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
  t.end()
})

test('cleanAll removes persistent mocks', async t => {
  nock('http://example.test')
    .persist()
    .get('/')
    .reply()

  nock.cleanAll()

  await assertRejects(got('http://example.test/'), err => {
    expect(err).to.include({
      name: 'RequestError',
      code: 'ENOTFOUND',
    })
    return true
  })
})

test('is done works', async t => {
  nock('http://example.test')
    .get('/')
    .reply(200)

  expect(nock.isDone()).to.be.false()

  await got('http://example.test/')

  expect(nock.isDone()).to.be.true()
})

test('isDone', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  expect(scope.isDone()).to.be.false()

  await got('http://example.test/')

  expect(scope.isDone()).to.be.true()

  scope.done()
})

test('pending mocks works', async t => {
  nock('http://example.test')
    .get('/')
    .reply()

  expect(nock.pendingMocks()).to.deep.equal(['GET http://example.test:80/'])

  await got('http://example.test/')

  expect(nock.pendingMocks()).to.be.empty()
})

test('activeMocks returns incomplete mocks', t => {
  nock('http://example.test')
    .get('/')
    .reply(200)
  expect(nock.activeMocks()).to.deep.equal(['GET http://example.test:80/'])
  t.end()
})

test("activeMocks doesn't return completed mocks", async t => {
  nock('http://example.test')
    .get('/')
    .reply()

  await got('http://example.test/')
  expect(nock.activeMocks()).to.be.empty()
  t.end()
})

test('resetting nock catastrophically while a request is in progress is handled gracefully', async t => {
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

test('abort pending request when abortPendingRequests is called', t => {
  const onRequest = sinon.spy()

  nock('http://example.test')
    .get('/')
    .delayConnection(100)
    .reply(200, 'OK')

  http.get('http://example.test', onRequest)

  setTimeout(() => {
    expect(onRequest).not.to.have.been.called()
    t.end()
  }, 200)
  process.nextTick(nock.abortPendingRequests)
})
