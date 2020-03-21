'use strict'

const { expect } = require('chai')
const { test } = require('tap')
const assertRejects = require('assert-rejects')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('basic auth with username and password', async (t) => {
  t.beforeEach((done) => {
    nock('http://example.test')
      .get('/test')
      .basicAuth({ user: 'foo', pass: 'bar' })
      .reply(200, 'Here is the content')
    done()
  })

  await t.test('succeeds when it matches', async () => {
    const response = await got('http://example.test/test', {
      username: 'foo',
      password: 'bar',
    })
    expect(response.statusCode).to.equal(200)
    expect(response.body).to.equal('Here is the content')
  })

  await t.test('fails when it doesnt match', async () => {
    await assertRejects(
      got('http://example.test/test'),
      /Nock: No match for request/
    )
  })
})

test('basic auth with username only', async (t) => {
  t.beforeEach((done) => {
    nock('http://example.test')
      .get('/test')
      .basicAuth({ user: 'foo' })
      .reply(200, 'Here is the content')
    done()
  })

  await t.test('succeeds when it matches', async () => {
    const response = await got('http://example.test/test', {
      username: 'foo',
      password: '',
    })
    expect(response.statusCode).to.equal(200)
    expect(response.body).to.equal('Here is the content')
  })

  await t.test('fails when it doesnt match', async () => {
    await assertRejects(
      got('http://example.test/test'),
      /Nock: No match for request/
    )
  })
})
