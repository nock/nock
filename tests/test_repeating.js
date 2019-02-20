'use strict'

const http = require('http')
const async = require('async')
const { test } = require('tap')
const nock = require('..')

test('repeating once', t => {
  nock.disableNetConnect()

  nock('http://example.test')
    .get('/')
    .once()
    .reply(200, 'Hello World!')

  http.get('http://example.test', function(res) {
    t.equal(200, res.statusCode, 'first request')
    t.end()
  })

  nock.cleanAll()

  nock.enableNetConnect()
})

test('repeating twice', t => {
  nock.disableNetConnect()

  nock('http://example.test')
    .get('/')
    .twice()
    .reply(200, 'Hello World!')

  async.each(
    [1, 2],
    function(_, cb) {
      http.get('http://example.test', function(res) {
        t.equal(200, res.statusCode)
        cb()
      })
    },
    t.end.bind(t)
  )
})

test('repeating thrice', t => {
  nock.disableNetConnect()

  nock('http://example.test')
    .get('/')
    .thrice()
    .reply(200, 'Hello World!')

  async.each(
    [1, 2, 3],
    function(_, cb) {
      http.get('http://example.test', function(res) {
        t.equal(200, res.statusCode)
        cb()
      })
    },
    t.end.bind(t)
  )
})

test('repeating response 4 times', t => {
  nock.disableNetConnect()

  nock('http://example.test')
    .get('/')
    .times(4)
    .reply(200, 'Hello World!')

  async.each(
    [1, 2, 3, 4],
    function(_, cb) {
      http.get('http://example.test', function(res) {
        t.equal(200, res.statusCode, 'first request')
        cb()
      })
    },
    t.end.bind(t)
  )
})

test('isDone() must consider repeated responses', t => {
  const scope = nock('http://example.test')
    .get('/')
    .times(2)
    .reply(204)

  function makeRequest(callback) {
    const req = http.request(
      {
        host: 'example.test',
        path: '/',
        port: 80,
      },
      function(res) {
        t.equal(res.statusCode, 204)
        res.on('end', callback)
        // Streams start in 'paused' mode and must be started.
        // See https://nodejs.org/api/stream.html#stream_class_stream_readable
        res.resume()
      }
    )
    req.end()
  }

  t.notOk(scope.isDone(), 'should not be done before all requests')
  makeRequest(function() {
    t.notOk(scope.isDone(), 'should not yet be done after the first request')
    makeRequest(function() {
      t.ok(scope.isDone(), 'should be done after the two requests are made')
      scope.done()
      t.end()
    })
  })
})
