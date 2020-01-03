'use strict'

const { expect } = require('chai')
const { test } = require('tap')
const request = require('request')
const lolex = require('lolex')
const nock = require('..')

require('./cleanup_after_each')()
require('./setup')

// https://github.com/nock/nock/issues/1334
test('one function returns successfully when fake timer is enabled', t => {
  const clock = lolex.install()
  nock('http://example.test')
    .get('/')
    .reply(200)

  request.get('http://example.test', function(err, resp) {
    clock.uninstall()

    expect(err).to.be.null()
    expect(resp.statusCode).to.equal(200)
    t.end()
  })
})
