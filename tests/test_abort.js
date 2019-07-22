'use strict'

const nock = require('..')
const http = require('http')
const { test } = require('tap')

require('./cleanup_after_each')()

test('req.abort() should cause "abort" and "error" to be emitted', t => {
  const scope = nock('http://example.test')
    .get('/')
    .delayConnection(500)
    .reply()

  let gotAbort = false
  const req = http
    .get('http://example.test/')
    .once('abort', () => {
      // Should trigger first
      gotAbort = true
    })
    .once('error', err => {
      // Should trigger last
      t.equal(err.code, 'ECONNRESET')
      t.ok(gotAbort, "didn't get abort event")
      scope.done()
      t.end()
    })
  process.nextTick(() => req.abort())
})

test('abort is emitted before delay time', t => {
  const scope = nock('http://example.test')
    .get('/')
    .delayConnection(500)
    .reply()

  const tstart = Date.now()
  const req = http
    .get('http://example.test/')
    .once('abort', () => {
      const actual = Date.now() - tstart
      t.ok(actual < 250, `abort took only ${actual} ms`)
      scope.done()
      t.end()
    })
    .once('error', () => {}) // Don't care.
  // Don't bother with the response

  setTimeout(() => req.abort(), 10)
})

test('Aborting an aborted request should not emit an error', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  let errorCount = 0
  const req = http.get('http://example.test/').on('error', () => {
    errorCount++
    if (errorCount < 3) {
      // Abort 3 times at max, otherwise this would be an endless loop.
      // https://github.com/nock/nock/issues/882
      req.abort()
    }
  })
  req.abort()

  // Allow some time to fail.
  setTimeout(() => {
    t.equal(errorCount, 1, 'Only one error should be sent.')
    scope.done()
    t.end()
  }, 10)
})

test('Aborting a not-yet-ended request should end it', t => {
  // Set up.
  const scope = nock('http://example.test')
    .post('/')
    .reply()

  const req = http.request({
    host: 'example.test',
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

  const scope = nock('http://example.test')
    .get('/')
    .reply()

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
      scope.done()
      t.end()
    }
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.write('some nonsense'))
})

test('`req.end()` on an aborted request should trigger the expected error', t => {
  t.plan(2)

  const scope = nock('http://example.test')
    .get('/')
    .reply()

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
      scope.done()
      t.end()
    }
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.end())
})

test('`req.flushHeaders()` on an aborted request should trigger the expected error', t => {
  t.plan(2)

  const scope = nock('http://example.test')
    .get('/')
    .reply()

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
      scope.done()
      t.end()
    }
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.flushHeaders())
})
