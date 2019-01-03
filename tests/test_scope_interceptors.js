'use strict'

const nock = require('../')
const { test } = require('tap')

test('scope exposes interceptors', function(t) {
  nock.load(`${__dirname}/fixtures/goodRequest.json`).forEach(function(scope) {
    scope.interceptors.forEach(function(interceptor) {
      interceptor.delayConnection(100)
    })
  })
  t.end()
})
