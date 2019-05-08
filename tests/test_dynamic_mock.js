'use strict'

const { test } = require('tap')
const request = require('request')
const nock = require('..')

require('./cleanup_after_each')()

test('one function not returning an array causes an error', function(t) {
  nock('http://example.test')
    .get('/abc')
    .reply(function() {
      return 'ABC'
    })

  request.get('http://example.test/abc', function(err) {
    t.match(
      err,
      Error('A single function provided to .reply MUST return an array')
    )
    t.end()
  })
})

test('one function returning an empty array causes an error', function(t) {
  nock('http://example.test')
    .get('/abc')
    .reply(function() {
      return []
    })

  request.get('http://example.test/abc', function(err) {
    t.match(err, Error('Invalid undefined value for status code'))
    t.end()
  })
})

test('one function returning too large an array causes an error', function(t) {
  nock('http://example.test')
    .get('/abc')
    .reply(function() {
      return ['user', 'probably', 'intended', 'this', 'to', 'be', 'JSON']
    })

  request.get('http://example.test/abc', function(err) {
    t.match(
      err,
      Error(
        'The array returned from the .reply callback contains too many values'
      )
    )
    t.end()
  })
})

test('one function throws an error if extraneous args are provided', function(t) {
  const interceptor = nock('http://example.test').get('/')
  t.throws(
    () => interceptor.reply(() => [200], { 'x-my-header': 'some-value' }),
    Error('Invalid arguments')
  )

  t.end()
})

test('one function returning the status code and body defines a full mock', function(t) {
  nock('http://example.test')
    .get('/def')
    .reply(function() {
      return [201, 'DEF']
    })

  request.get('http://example.test/def', function(err, resp, body) {
    t.error(err)
    t.equal(resp.statusCode, 201)
    t.equal(body, 'DEF')
    t.end()
  })
})

test('one function returning an array can set headers', function(t) {
  nock('http://example.test')
    .get('/def')
    .reply(function() {
      return [201, 'DEF', { 'X-My-Header': 'some-value' }]
    })

  request.get('http://example.test/def', function(err, resp, body) {
    t.error(err)
    t.equal(resp.statusCode, 201)
    t.equal(body, 'DEF')
    t.deepEqual(resp.headers, { 'x-my-header': 'some-value' })
    t.end()
  })
})

test('one asynchronous function returning the status code and body defines a full mock', function(t) {
  nock('http://example.test')
    .get('/ghi')
    .reply(function(path, reqBody, cb) {
      setTimeout(function() {
        cb(null, [201, 'GHI'])
      }, 1e3)
    })

  request.get('http://example.test/ghi', function(err, resp, body) {
    t.error(err)
    t.equal(resp.statusCode, 201)
    t.equal(body, 'GHI')
    t.end()
  })
})

test('asynchronous function gets request headers', function(t) {
  nock('http://example.test')
    .get('/yo')
    .reply(201, function(path, reqBody, cb) {
      t.equal(this.req.path, '/yo')
      t.deepEqual(this.req.headers, {
        'x-my-header': 'some-value',
        'x-my-other-header': 'some-other-value',
        host: 'example.test',
      })
      setTimeout(function() {
        cb(null, 'foobar')
      }, 1e3)
    })

  request(
    {
      method: 'GET',
      uri: 'http://example.test/yo',
      headers: {
        'x-my-header': 'some-value',
        'x-my-other-header': 'some-other-value',
      },
    },
    function(err, resp, body) {
      t.error(err)
      t.equal(resp.statusCode, 201)
      t.equal(body, 'foobar')
      t.end()
    }
  )
})
