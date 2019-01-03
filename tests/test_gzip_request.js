'use strict'

const nock = require('../')
const { test } = require('tap')
const http = require('http')
const zlib = require('zlib')

if (zlib.gzipSync && zlib.gunzipSync) {
  test('accepts and decodes gzip encoded application/json', function(t) {
    const message = {
      my: 'contents',
    }

    t.plan(1)

    nock('http://gzipped.com')
      .post('/')
      .reply(function(url, actual) {
        t.same(actual, message)
        t.end()
        return 200
      })

    const req = http.request({
      hostname: 'gzipped.com',
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
}

if (zlib.deflateSync && zlib.inflateSync) {
  test('accepts and decodes deflate encoded application/json', function(t) {
    const message = {
      my: 'contents',
    }

    t.plan(1)

    nock('http://gzipped.com')
      .post('/')
      .reply(function(url, actual) {
        t.same(actual, message)
        t.end()
        return 200
      })

    const req = http.request({
      hostname: 'gzipped.com',
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
}
