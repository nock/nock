'use strict'

const http = require('http')
const url = require('url')
const { test } = require('tap')
const got = require('got')
const nock = require('..')

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

test('(re-)activate after restore', t => {
  t.plan(7)

  const server = http.createServer((request, response) => {
    t.pass('server received a request')

    switch (url.parse(request.url).pathname) {
      case '/':
        response.writeHead(200)
        response.write('server served a response')
        break
    }

    response.end()
  })

  server.listen(() => {
    const scope = nock(`http://localhost:${server.address().port}`)
      .get('/')
      .reply(304, 'served from our mock')

    nock.restore()
    t.false(nock.isActive())

    http.get(`http://localhost:${server.address().port}`, function(res) {
      res.resume()

      t.is(200, res.statusCode)

      res.on('end', function() {
        t.ok(!scope.isDone())

        nock.activate()
        t.true(nock.isActive())
        http.get(`http://localhost:${server.address().port}`, function(res) {
          res.resume()

          t.is(304, res.statusCode)

          res.on('end', function() {
            t.ok(scope.isDone())

            server.close(t.end)
          })
        })
      })
    })
  })
})

test('clean all works', t => {
  nock('http://example.test')
    .get('/nonexistent')
    .reply(200)

  http.get({ host: 'example.test', path: '/nonexistent' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock before cleanup')

    nock.cleanAll()

    http
      .get({ host: 'example.test', path: '/nonexistent' }, function(res) {
        res.destroy()
        t.assert(res.statusCode !== 200, 'should clean up properly')
        t.end()
      })
      .on('error', function(err) {
        t.end()
      })
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

test('is done works', t => {
  nock('http://example.test')
    .get('/nonexistent')
    .reply(200)

  t.ok(!nock.isDone())

  http.get({ host: 'example.test', path: '/nonexistent' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock before cleanup')
    t.ok(nock.isDone())
    t.end()
  })
})

test('isDone', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .reply(200, 'Hello World!')

  t.notOk(scope.isDone(), 'not done when a request is outstanding')

  await got('http://example.com/')

  t.true(scope.isDone(), 'done after request is made')
  scope.done()
})

test('pending mocks works', t => {
  nock('http://example.test')
    .get('/nonexistent')
    .reply(200)

  t.deepEqual(nock.pendingMocks(), ['GET http://example.test:80/nonexistent'])

  http.get({ host: 'example.test', path: '/nonexistent' }, function(res) {
    t.assert(res.statusCode === 200, 'should mock before cleanup')
    t.deepEqual(nock.pendingMocks(), [])
    t.end()
  })
})

test('activeMocks returns incomplete mocks', t => {
  nock.cleanAll()
  nock('http://example.test')
    .get('/incomplete')
    .reply(200)

  t.deepEqual(nock.activeMocks(), ['GET http://example.test:80/incomplete'])
  t.end()
})

test("activeMocks doesn't return completed mocks", t => {
  nock.cleanAll()
  nock('http://example.test')
    .get('/complete-me')
    .reply(200)

  http.get({ host: 'example.test', path: '/complete-me' }, function(res) {
    t.deepEqual(nock.activeMocks(), [])
    t.end()
  })
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
