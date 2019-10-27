'use strict'

// Tests for `.replyWithError()`.

const http = require('http')
const { test } = require('tap')
const { expect } = require('chai')
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
  req.on('error', e => {
    expect(e)
      .to.be.an.instanceof(Error)
      .and.include({ message: 'Service not found' })
    scope.done()
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
  req.on('error', e => {
    expect(e).to.deep.equal({
      message: 'Service not found',
      code: 'test',
    })
    scope.done()
    t.end()
  })

  req.end()
})
