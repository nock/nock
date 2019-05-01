'use strict'

// Tests for `.replyWithError()`.

const http = require('http')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_after_each')()

test('replyWithError returns an error on request', t => {
  const scope = nock('http://example.test')
    .post('/echo')
    .replyWithError('Service not found')

  const req = http.request({
    host: 'example.test',
    method: 'POST',
    path: '/echo',
    port: 80,
  })

  // An error should have have been raised
  req.on('error', function(e) {
    scope.done()
    t.equal(e.message, 'Service not found')
    t.end()
  })

  req.end()
})

test('replyWithError allows json response', t => {
  const scope = nock('http://example.test')
    .post('/echo')
    .replyWithError({ message: 'Service not found', code: 'test' })

  const req = http.request({
    host: 'example.test',
    method: 'POST',
    path: '/echo',
    port: 80,
  })

  // An error should have have been raised
  req.on('error', function(e) {
    scope.done()
    t.equal(e.message, 'Service not found')
    t.equal(e.code, 'test')
    t.end()
  })

  req.end()
})
