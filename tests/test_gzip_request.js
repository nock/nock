'use strict'

const { test } = require('tap')
const http = require('http')
const zlib = require('zlib')
const nock = require('..')

require('./cleanup_hook')()

test('accepts and decodes gzip encoded application/json', t => {
  const message = {
    my: 'contents',
  }

  t.plan(1)

  nock('http://example.test')
    .post('/')
    .reply(function(url, actual) {
      t.same(actual, message)
      t.end()
      return 200
    })

  const req = http.request({
    hostname: 'example.test',
    path: '/',
    method: 'POST',
    headers: {
      'content-encoding': 'gzip',
      'content-type': 'application/json',
    },
  })

  const compressedMessage = zlib.gzipSync(JSON.stringify(message))

  req.write(compressedMessage)
  req.end()
})

test('accepts and decodes deflate encoded application/json', t => {
  const message = {
    my: 'contents',
  }

  t.plan(1)

  nock('http://example.test')
    .post('/')
    .reply(function(url, actual) {
      t.same(actual, message)
      t.end()
      return 200
    })

  const req = http.request({
    hostname: 'example.test',
    path: '/',
    method: 'POST',
    headers: {
      'content-encoding': 'deflate',
      'content-type': 'application/json',
    },
  })

  const compressedMessage = zlib.deflateSync(JSON.stringify(message))

  req.write(compressedMessage)
  req.end()
})
