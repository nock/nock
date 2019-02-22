'use strict'

const { test } = require('tap')
const got = require('got')
const nock = require('..')

require('./cleanup_hook')()

test('follows redirects', async t => {
  const scope = nock('http://example.test')
    .get('/YourAccount')
    .reply(302, undefined, {
      Location: 'http://example.test/Login',
    })
    .get('/Login')
    .reply(200, 'Here is the login page')

  const { statusCode, body } = await got('http://example.test/YourAccount')

  t.is(statusCode, 200)
  t.equal(body, 'Here is the login page')

  scope.done()
})
