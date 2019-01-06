'use strict'

const nock = require('../')
const { test } = require('tap')
const rp = require('request-promise')

test('IPV6 URL in request-promise get gets mocked', function(t) {
  const payload = 'somedata'
  const target = 'http://[2607:f0d0:1002:51::4]:8080'

  nock(target)
    .post('/update')
    .reply(200, payload)

  rp({
    uri: `${target}/update`,
    method: 'POST',
    body: payload,
  }).then(function(res) {
    t.equal(res.toString(), payload, 'response should match')
    t.end()
  })
})
