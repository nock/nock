'use strict'

const http = require('http')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('double activation throws exception', t => {
  nock.restore()
  t.false(nock.isActive())

  nock.activate()
  t.true(nock.isActive())

  t.throws(() => nock.activate(), { message: 'Nock already active' })

  t.true(nock.isActive())

  t.end()
})

test('(re-)activate after restore', async t => {
  t.plan(7)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')

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
  t.false(nock.isActive())

  t.is((await got(url)).statusCode, 200)

  t.false(scope.isDone())

  nock.activate()
  t.true(nock.isActive())

  t.is((await got(url)).statusCode, 304)

  t.true(scope.isDone())
})

test('clean all works', async t => {
  nock('http://example.test')
    .get('/')
    .reply()

  await got('http://example.test/')

  nock.cleanAll()

  await t.rejects(got('http://example.test/'), {
    name: 'RequestError',
    code: 'ENOTFOUND',
  })
})

test('cleanAll should remove pending mocks from all scopes', t => {
  const scope1 = nock('http://example.test')
    .get('/somepath')
    .reply(200, 'hey')
  t.deepEqual(scope1.pendingMocks(), ['GET http://example.test:80/somepath'])
  const scope2 = nock('http://example.test')
    .get('/somepath')
    .reply(200, 'hey')
  t.deepEqual(scope2.pendingMocks(), ['GET http://example.test:80/somepath'])

  nock.cleanAll()

  t.deepEqual(scope1.pendingMocks(), [])
  t.deepEqual(scope2.pendingMocks(), [])
  t.end()
})

test('is done works', async t => {
  nock('http://example.test')
    .get('/')
    .reply(200)

  t.false(nock.isDone())

  await got('http://example.test/')

  t.true(nock.isDone())
})

test('isDone', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  t.false(scope.isDone())

  await got('http://example.test/')

  t.true(scope.isDone())

  scope.done()
})

test('pending mocks works', async t => {
  nock('http://example.test')
    .get('/')
    .reply()

  t.deepEqual(nock.pendingMocks(), ['GET http://example.test:80/'])

  await got('http://example.test/')

  t.deepEqual(nock.pendingMocks(), [])
})

test('activeMocks returns incomplete mocks', t => {
  nock('http://example.test')
    .get('/')
    .reply(200)
  t.deepEqual(nock.activeMocks(), ['GET http://example.test:80/'])
  t.end()
})

test("activeMocks doesn't return completed mocks", async t => {
  nock('http://example.test')
    .get('/')
    .reply()

  await got('http://example.test/')
  t.deepEqual(nock.activeMocks(), [])
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

  const scope = nock('http://example.test')
    .get('/somepath')
    .reply(200, (uri, requestBody) => {
      somethingBad()
      return 'hi'
    })

  const { body } = await got('http://example.test/somepath')

  t.equal(body, 'hi')
  scope.done()
})
