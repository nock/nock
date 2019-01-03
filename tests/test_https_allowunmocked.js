'use strict'

const { test } = require('tap')
const mikealRequest = require('request')
const nock = require('../')

nock.enableNetConnect()

// Do not copy tests that rely on the process.env.AIRPLANE, we are deprecating that via #1231
test('allowUnmocked for https', { skip: process.env.AIRPLANE }, function(t) {
  nock('https://www.google.com/', { allowUnmocked: true })
    .get('/pathneverhit')
    .reply(200, { foo: 'bar' })

  const options = {
    method: 'GET',
    uri: 'https://www.google.com',
  }

  mikealRequest(options, function(err, resp, body) {
    t.notOk(err, 'should be no error')
    t.true(typeof body !== 'undefined', 'body should not be undefined')
    t.true(body.length !== 0, 'body should not be empty')
    t.end()
  })
})

// Do not copy tests that rely on the process.env.AIRPLANE, we are deprecating that via #1231
test(
  'allowUnmocked for https with query test miss',
  { skip: process.env.AIRPLANE },
  function(t) {
    nock.cleanAll()
    nock('https://www.google.com', { allowUnmocked: true })
      .get('/search')
      .query(function() {
        return false
      })
      .reply(500)

    const options = {
      method: 'GET',
      uri: 'https://www.google.com/search',
    }

    mikealRequest(options, function(err, resp, body) {
      t.notOk(err, 'should be no error')
      t.true(typeof body !== 'undefined', 'body should not be undefined')
      t.true(body.length !== 0, 'body should not be empty')
      t.end()
    })
  }
)
