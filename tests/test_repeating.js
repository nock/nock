'use strict'

const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')
const assertRejects = require('assert-rejects')

require('./cleanup_after_each')()

test('repeating once', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .once()
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/')
  t.is(statusCode, 200)

  await assertRejects(
    got('http://example.test/'),
    Error,
    'Nock: No match for request'
  )

  scope.done()
})

test('repeating twice', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .twice()
    .reply(200, 'Hello World!')

  for (const count of [1, 2]) {
    const { statusCode } = await got('http://example.test/')
    t.is(statusCode, 200)
  }

  await assertRejects(
    got('http://example.test/'),
    Error,
    'Nock: No match for request'
  )

  scope.done()
})

test('repeating thrice', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .thrice()
    .reply(200, 'Hello World!')

  for (const count of [1, 2, 3]) {
    const { statusCode } = await got('http://example.test/')
    t.is(statusCode, 200)
  }

  await assertRejects(
    got('http://example.test/'),
    Error,
    'Nock: No match for request'
  )

  scope.done()
})

test('repeating response 4 times', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .times(4)
    .reply(200, 'Hello World!')

  for (const count of [1, 2, 3, 4]) {
    const { statusCode } = await got('http://example.test/')
    t.is(statusCode, 200)
  }

  await assertRejects(
    got('http://example.test/'),
    Error,
    'Nock: No match for request'
  )

  scope.done()
})

test('times with invalid argument is ignored', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .times(0)
    .reply(200, 'Hello World!')

  const { statusCode } = await got('http://example.test/')
  t.is(statusCode, 200)

  await assertRejects(
    got('http://example.test/'),
    Error,
    'Nock: No match for request'
  )

  scope.done()
})

test('isDone() must consider repeated responses', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .times(2)
    .reply(204)

  for (const count of [1, 2]) {
    t.is(scope.isDone(), false)
    await got('http://example.test/')
  }
  t.is(scope.isDone(), true)

  scope.done()
})
