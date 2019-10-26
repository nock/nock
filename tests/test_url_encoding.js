'use strict'

const { test } = require('tap')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()

test('url encoding', async t => {
  const scope = nock('http://example.test')
    .get('/key?a=[1]')
    .reply(200)

  const { statusCode } = await got('http://example.test/key?a=[1]')
  expect(statusCode).to.equal(200)

  scope.done()
})
