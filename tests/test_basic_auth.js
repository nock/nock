'use strict'

const { test } = require('tap')
const got = require('got')
const nock = require('..')

require('./cleanup_after_each')()

test('basic auth with username and password', async t => {
  t.beforeEach(done => {
    nock('http://example.test')
      .get('/test')
      .basicAuth({ user: 'foo', pass: 'bar' })
      .reply(200, 'Here is the content')
    done()
  })

  await t.test('succeeds when it matches', async tt => {
    const response = await got('http://example.test/test', {
      auth: 'foo:bar',
    })
    tt.equal(response.statusCode, 200)
    tt.equal(response.body, 'Here is the content')
  })

  await t.test('fails when it doesnt match', async tt => {
    await tt.rejects(() => got('http://example.test/test'), {
      message: 'Nock: No match for request',
    })
  })
})

test('basic auth with username only', async t => {
  t.beforeEach(done => {
    nock('http://example.test')
      .get('/test')
      .basicAuth({ user: 'foo' })
      .reply(200, 'Here is the content')
    done()
  })

  await t.test('succeeds when it matches', async tt => {
    const response = await got('http://example.test/test', { auth: 'foo:' })
    tt.equal(response.statusCode, 200)
    tt.equal(response.body, 'Here is the content')
  })

  await t.test('fails when it doesnt match', async tt => {
    await tt.rejects(() => got('http://example.test/test'), {
      message: 'Nock: No match for request',
    })
  })
})
