'use strict'

const { expect } = require('chai')
const http = require('http')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_after_each')()
require('./setup')

test('req.destroy should emit error event if called with error', t => {
  nock('http://example.test')
    .get('/')
    .reply(404)

  const respErr = new Error('Response error')

  http
    .get('http://example.test/', res => {
      expect(res.statusCode).to.equal(404)
      res.destroy(respErr)
    })
    .once('error', err => {
      expect(err).to.equal(respErr)
      t.end()
    })
})

test('req.destroy should not emit error event if called without error', t => {
  nock('http://example.test')
    .get('/')
    .reply(403)

  http
    .get('http://example.test/', res => {
      expect(res.statusCode).to.equal(403)
      res.destroy()
      t.end()
    })
    .once('error', () => {
      expect.fail('should not emit error')
    })
})
