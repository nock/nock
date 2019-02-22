'use strict'

const { test } = require('tap')
const request = require('request')
const lolex = require('lolex')
const nock = require('..')

require('./cleanup_hook')()

// https://github.com/nock/nock/issues/1334
test('one function returns successfully when fake timer is enabled', t => {
  const clock = lolex.install()
  nock('http://example.test')
    .get('/')
    .reply(200)

  request.get('http://example.test', function(err, resp) {
    clock.uninstall()
    if (err) {
      throw err
    }
    t.equal(resp.statusCode, 200)
    t.end()
  })
})
