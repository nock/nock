'use strict'

const { test } = require('tap')
const assertRejects = require('assert-rejects')
const nock = require('..')
const got = require('./got_client')

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
      username: 'foo',
      password: 'bar',
    })
    tt.equal(response.statusCode, 200)
    tt.equal(response.body, 'Here is the content')
  })

  await t.test('fails when it doesnt match', async tt => {
    await assertRejects(
      got('http://example.test/test'),
      /Nock: No match for request/
    )
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
    const response = await got('http://example.test/test', {
      username: 'foo',
      password: '',
    })
    tt.equal(response.statusCode, 200)
    tt.equal(response.body, 'Here is the content')
  })

  await t.test('fails when it doesnt match', async tt => {
    await assertRejects(
      got('http://example.test/test'),
      /Nock: No match for request/
    )
  })
})
