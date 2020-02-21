'use strict'

const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

require('./setup')

it('encode query string', async () => {
  const query1 = { q: '(nodejs)' }

  const scope = nock('https://example.test')
    .get('/test')
    .query(query1)
    .reply(200, 'success')

  const { statusCode, body } = await got('https://example.test/test?q=(nodejs)')

  expect(statusCode).to.equal(200)
  expect(body).to.equal('success')

  scope.done()
})
