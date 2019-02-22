'use strict'

const { test } = require('tap')
const qs = require('qs')
const got = require('got')
const nock = require('..')

require('./cleanup_hook')()

const exampleText = 'it worked!'

test('query with array', async t => {
  // In Node 10.x this can be updated:
  // const exampleQuery = new URLSearchParams([
  //   ['list', 123],
  //   ['list', 456],
  //   ['list', 789],
  //   ['a', 'b'],
  // ])
  const expectedQuery = { list: [123, 456, 789], a: 'b' }

  const scope = nock('http://example.test')
    .get('/test')
    .query(expectedQuery)
    .reply(200, exampleText)
  await got(`http://example.test/test?${qs.stringify(expectedQuery)}`)

  scope.done()
})

// These tests enforce the historical behavior of query strings as encoded by
// the `qs` library. These are not standard, although they are compatible with
// the `qs` option to `request`.
test('query with array which contains unencoded value', async t => {
  const expectedQuery = { list: ['hello%20world', '2hello%20world', 3], a: 'b' }

  const scope = nock('http://example.test')
    .get('/test')
    .query(expectedQuery)
    .reply(200, exampleText)
  await got(`http://example.test/test?${qs.stringify(expectedQuery)}`)

  scope.done()
})

test('query with array which contains pre-encoded values ', async t => {
  const expectedQuery = { list: ['hello%20world', '2hello%20world'] }
  const queryString = 'list%5B0%5D=hello%20world&list%5B1%5D=2hello%20world'

  const scope = nock('http://example.test', { encodedQueryParams: true })
    .get('/test')
    .query(expectedQuery)
    .reply(200, exampleText)
  await got(`http://example.test/test?${queryString}`)

  scope.done()
})

test('query with object', async t => {
  const expectedQuery = {
    a: {
      b: ['c', 'd'],
    },
    e: [1, 2, 3, 4],
  }

  const scope = nock('http://example.test')
    .get('/test')
    .query(expectedQuery)
    .reply(200, exampleText)
  await got(`http://example.test/test?${qs.stringify(expectedQuery)}`)

  scope.done()
})

test('query with object which contains unencoded value', async t => {
  const exampleQuery = {
    a: {
      b: 'hello%20world',
    },
  }

  const scope = nock('http://example.test')
    .get('/test')
    .query(exampleQuery)
    .reply(200, exampleText)
  await got(`http://example.test/test?${qs.stringify(exampleQuery)}`)

  scope.done()
})

test('query with object which contains pre-encoded values', async t => {
  const queryString = 'a%5Bb%5D=hello%20world'
  const exampleQuery = {
    a: {
      b: 'hello%20world',
    },
  }

  const scope = nock('http://example.test', { encodedQueryParams: true })
    .get('/test')
    .query(exampleQuery)
    .reply(200, exampleText)
  await got(`http://example.test/test?${queryString}`)

  scope.done()
})

test('query with array and regexp', async t => {
  const exampleQuery = {
    list: [123, 456, 789],
    foo: 'bar',
    a: 'b',
  }
  // In Node 10.x this can be updated:
  // const exampleQuery = new URLSearchParams([
  //   ['list', 123],
  //   ['list', 456],
  //   ['list', 789],
  //   ['foo', 'bar'],
  //   ['a', 'b'],
  // ])
  const expectedQuery = {
    list: [123, 456, 789],
    foo: /.*/,
    a: 'b',
  }

  const scope = nock('http://example.test')
    .get('/test')
    .query(expectedQuery)
    .reply(200, exampleText)
  await got(`http://example.test/test?${qs.stringify(exampleQuery)}`)

  scope.done()
})
