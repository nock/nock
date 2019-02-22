'use strict'

const nock = require('..')
const http = require('http')
const { test } = require('tap')

require('./cleanup_hook')()

test('[actual] req.abort() should cause "abort" and "error" to be emitted', t => {
  nock('http://localhost:16829')
    .get('/status')
    .delayConnection(500)
    .reply(204)

  let gotAbort = false
  const req = http
    .get('http://localhost:16829/status')
    .once('abort', () => {
      // Should trigger first
      gotAbort = true
    })
    .once('error', err => {
      // Should trigger last
      t.equal(err.code, 'ECONNRESET')
      t.ok(gotAbort, "didn't get abort event")
      t.end()
    })
  process.nextTick(() => req.abort())
})

test('abort is emitted before delay time', t => {
  nock('http://example.test')
    .get('/status')
    .delayConnection(500)
    .reply(204)

  const tstart = Date.now()
  const req = http
    .get('http://example.test/status')
    .once('abort', () => {
      const actual = Date.now() - tstart
      t.ok(actual < 250, `abort took only ${actual} ms`)
      t.end()
    })
    .once('error', () => {}) // Don't care.
  // Don't bother with the response

  setTimeout(() => req.abort(), 10)
})

test('Aborting an aborted request should not emit an error', t => {
  nock('http://example.test')
    .get('/status')
    .reply(200)

  let errorCount = 0
  const req = http.get('http://example.test/status').on('error', err => {
    errorCount++
    if (errorCount < 3) {
      // Abort 3 times at max, otherwise this would be an endless loop,
      // if #882 pops up again.
      req.abort()
    }
  })
  req.abort()

  // Allow some time to fail.
  setTimeout(() => {
    t.equal(errorCount, 1, 'Only one error should be sent.')
    t.end()
  }, 10)
})

test('Aborting a not-yet-ended request should end it', t => {
  // Set up.
  const scope = nock('http://test.example.com')
    .post('/')
    .reply(200)

  const req = http.request({
    host: 'test.example.com',
    method: 'post',
    path: '/',
  })
  req.on('error', () => {})

  // Act.
  req.abort()

  // Assert.
  scope.done()

  t.end()
})

test('`req.write() on an aborted request should trigger the expected error', t => {
  t.plan(2)

  nock('http://example.test')
    .get('/')
    .reply(200)

  let callCount = 0
  const req = http.get('http://example.test/')

  // TODO: Fix behavior of `req.once()` and refactor this to use it.
  req.on('error', err => {
    ++callCount
    if (callCount === 1) {
      // This is the expected first error event emitted, triggered by
      // `req.abort()`.
      t.equal(err.code, 'ECONNRESET')
    } else if (callCount === 2) {
      // This is the abort error under test, triggered by `req.write()`
      t.equal(err.message, 'Request aborted')
      t.end()
    }
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.write('some nonsense'))
})

test('`req.end()` on an aborted request should trigger the expected error', t => {
  t.plan(2)

  nock('http://example.test')
    .get('/')
    .reply(200)

  let callCount = 0
  const req = http.get('http://example.test/')

  // TODO: Fix behavior of `req.once()` and refactor this to use it.
  req.on('error', err => {
    ++callCount
    if (callCount === 1) {
      // This is the expected first error event emitted, triggered by
      // `req.abort()`.
      t.equal(err.code, 'ECONNRESET')
    } else if (callCount === 2) {
      // This is the abort error under test, triggered by `req.write()`
      t.equal(err.message, 'Request aborted')
      t.end()
    }
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.end())
})

test('`req.flushHeaders()` on an aborted request should trigger the expected error', t => {
  t.plan(2)

  nock('http://example.test')
    .get('/')
    .reply(200)

  let callCount = 0
  const req = http.get('http://example.test/')

  // TODO: Fix behavior of `req.once()` and refactor this to use it.
  req.on('error', err => {
    ++callCount
    if (callCount === 1) {
      // This is the expected first error event emitted, triggered by
      // `req.abort()`.
      t.equal(err.code, 'ECONNRESET')
    } else if (callCount === 2) {
      // This is the abort error under test, triggered by `req.write()`
      t.equal(err.message, 'Request aborted')
      t.end()
    }
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.flushHeaders())
})
