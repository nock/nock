'use strict'

const nock = require('..')
const http = require('http')
const { test } = require('tap')

require('./cleanup_after_each')()

test('req.destroy should emit error event if called with error', t => {
  nock('http://example.test')
    .get('/')
    .reply(404)

  http
    .get('http://example.test/', res => {
      if (res.statusCode !== 200) {
        res.destroy(new Error('Response error'))
      }
    })
    .once('error', err => {
      t.type(err, Error)
      t.equal(err.message, 'Response error')
      t.end()
    })
})

test('req.destroy should not emit error event if called without error', t => {
  nock('http://example.test')
    .get('/')
    .reply(403)

  http
    .get('http://example.test/', res => {
      if (res.statusCode === 403) {
        res.destroy()
      }

      t.end()
    })
    .once('error', () => {
      t.fail('should not emit error')
    })
})
