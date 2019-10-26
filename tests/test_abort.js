'use strict'

const nock = require('..')
const { expect } = require('chai')
const http = require('http')
const sinon = require('sinon')
const { test } = require('tap')

require('./setup')
require('./cleanup_after_each')()

test('req.abort() should cause "abort" and "error" to be emitted', t => {
  const scope = nock('http://example.test')
    .get('/')
    .delayConnection(500)
    .reply()

  const onAbort = sinon.spy()
  const req = http
    .get('http://example.test/')
    .once('abort', onAbort)
    .once('error', err => {
      // Should trigger last
      expect(err.code).to.equal('ECONNRESET')
      expect(onAbort).to.have.been.calledOnce()
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

  const start = Date.now()
  const req = http
    .get('http://example.test/')
    .once('abort', () => {
      const actual = Date.now() - start
      expect(actual).to.be.below(250)
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
    expect(errorCount).to.equal(1, 'Only one error should be sent')
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
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const req = http.get('http://example.test/')

  req.once('error', err => {
    // This is the expected first error event emitted, triggered by
    // `req.abort()`.
    expect(err.code).to.equal('ECONNRESET')

    req.once('error', err => {
      // This is the abort error under test, triggered by `req.write()`
      expect(err.message).to.equal('Request aborted')
      scope.done()
      t.end()
    })
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.write('some nonsense'))
})

test('`req.end()` on an aborted request should trigger the expected error', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const req = http.get('http://example.test/')

  req.once('error', err => {
    // This is the expected first error event emitted, triggered by
    // `req.abort()`.
    expect(err.code).to.equal('ECONNRESET')

    req.once('error', err => {
      // This is the abort error under test, triggered by `req.end()`
      expect(err.message).to.equal('Request aborted')
      scope.done()
      t.end()
    })
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.end())
})

test('`req.flushHeaders()` on an aborted request should trigger the expected error', t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply()

  const req = http.get('http://example.test/')

  req.once('error', err => {
    // This is the expected first error event emitted, triggered by
    // `req.abort()`.
    expect(err.code).to.equal('ECONNRESET')

    req.once('error', err => {
      // This is the abort error under test, triggered by `req.flushHeaders()`
      expect(err.message).to.equal('Request aborted')
      scope.done()
      t.end()
    })
  })

  process.nextTick(() => req.abort())
  process.nextTick(() => req.flushHeaders())
})
