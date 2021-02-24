'use strict'

const nock = require('..')
const got = require('./got_client')

describe('`query()` complex encoding', () => {
  it('query with array', async () => {
    // In Node 10.x this can be updated:
    // const exampleQuery = new URLSearchParams([
    //   ['list', 123],
    //   ['list', 456],
    //   ['list', 789],
    //   ['a', 'b'],
    // ])
    const expectedQuery = { list: [123, 456, 789], a: 'b' }
    const encodedQuery = 'list=123&list=456&list=789&a=b'

    const scope = nock('http://example.test')
      .get('/test')
      .query(expectedQuery)
      .reply()
    await got(`http://example.test/test?${encodedQuery}`)

    scope.done()
  })

  // These tests enforce the historical behavior of query strings as encoded by
  // the `qs` library. These are not standard, although they are compatible with
  // the `qs` option to `request`.
  it('query with array which contains unencoded value', async () => {
    const expectedQuery = {
      list: ['hello%20world', '2hello%20world', 3],
      a: 'b',
    }
    const encodedQuery =
      'list%5B0%5D=hello%2520world&list%5B1%5D=2hello%2520world&list%5B2%5D=3&a=b'

    const scope = nock('http://example.test')
      .get('/test')
      .query(expectedQuery)
      .reply()
    await got(`http://example.test/test?${encodedQuery}`)

    scope.done()
  })

  it('query with array which contains pre-encoded values ', async () => {
    const expectedQuery = { list: ['hello%20world', '2hello%20world'] }
    const queryString = 'list%5B0%5D=hello%20world&list%5B1%5D=2hello%20world'

    const scope = nock('http://example.test', { encodedQueryParams: true })
      .get('/test')
      .query(expectedQuery)
      .reply()
    await got(`http://example.test/test?${queryString}`)

    scope.done()
  })

  it('query with object', async () => {
    const expectedQuery = {
      a: {
        b: ['c', 'd'],
      },
      e: [1, 2, 3, 4],
      q: '(nodejs)',
    }
    const encodedQuery =
      'a[b][0]=c&a[b][1]=d&e[0]=1&e[1]=2&e[2]=3&e[3]=4&q=(nodejs)'

    const scope = nock('http://example.test')
      .get('/test')
      .query(expectedQuery)
      .reply()
    await got(`http://example.test/test?${encodedQuery}`)

    scope.done()
  })

  it('query with object which contains unencoded value', async () => {
    const exampleQuery = {
      a: {
        b: 'hello%20world',
      },
    }
    const encodedQuery = 'a%5Bb%5D=hello%2520world'

    const scope = nock('http://example.test')
      .get('/test')
      .query(exampleQuery)
      .reply()
    await got(`http://example.test/test?${encodedQuery}`)

    scope.done()
  })

  it('query with object which contains pre-encoded values', async () => {
    const queryString = 'a%5Bb%5D=hello%20world'
    const exampleQuery = {
      a: {
        b: 'hello%20world',
      },
    }

    const scope = nock('http://example.test', { encodedQueryParams: true })
      .get('/test')
      .query(exampleQuery)
      .reply()
    await got(`http://example.test/test?${queryString}`)

    scope.done()
  })

  it('query with array and regexp', async () => {
    // In Node 10.x this can be updated:
    // const exampleQuery = new URLSearchParams([
    //   ['list', 123],
    //   ['list', 456],
    //   ['list', 789],
    //   ['foo', 'bar'],
    //   ['a', 'b'],
    // ]).toString()
    const encodedQuery = 'list=123&list=456&list=789&foo=bar&a=b'

    const expectedQuery = {
      list: [123, 456, 789],
      foo: /.*/,
      a: 'b',
    }

    const scope = nock('http://example.test')
      .get('/test')
      .query(expectedQuery)
      .reply()
    await got(`http://example.test/test?${encodedQuery}`)

    scope.done()
  })
})
