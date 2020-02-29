'use strict'

const { expect } = require('chai')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('one function returning the status code and body defines a full mock', async t => {
  const scope = nock('http://example.test')
    .get('/def')
    .reply(function() {
      return [201, 'DEF']
    })

  const { statusCode, body } = await got('http://example.test/def')
  expect(statusCode).to.equal(201)
  expect(body).to.equal('DEF')

  scope.done()
  t.end()
})

test('one asynchronous function returning the status code and body defines a full mock', async t => {
  const scope = nock('http://example.test')
    .get('/ghi')
    .reply(function(path, reqBody, cb) {
      setTimeout(function() {
        cb(null, [201, 'GHI'])
      }, 1e3)
    })

  const { statusCode, body } = await got('http://example.test/ghi')
  expect(statusCode).to.equal(201)
  expect(body).to.equal('GHI')

  scope.done()
  t.end()
})

test('asynchronous function gets request headers', async t => {
  const scope = nock('http://example.test')
    .get('/yo')
    .reply(201, function(path, reqBody, cb) {
      expect(this.req.path).to.equal('/yo')
      expect(this.req.headers).to.include({
        'x-my-header': 'some-value',
        'x-my-other-header': 'some-other-value',
        host: 'example.test',
      })
      setTimeout(function() {
        cb(null, 'foobar')
      }, 1e3)
    })

  const { statusCode, body } = await got('http://example.test/yo', {
    headers: {
      'x-my-header': 'some-value',
      'x-my-other-header': 'some-other-value',
    },
  })

  expect(statusCode).to.equal(201)
  expect(body).to.equal('foobar')

  scope.done()
  t.end()
})
