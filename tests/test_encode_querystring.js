'use strict'

const request = require('request')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_after_each')()

test('encode query string', t => {
  const query1 = { q: '(nodejs)' }

  nock('https://example.test')
    .get('/test')
    .query(query1)
    .reply(200, 'success')

  request(
    {
      url: 'https://example.test/test',
      qs: query1,
      method: 'GET',
    },
    function(error, response, body) {
      t.ok(!error)
      t.deepEqual(body, 'success')
      t.end()
    }
  )
})
