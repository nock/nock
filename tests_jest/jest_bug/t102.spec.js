'use strict'

const nock = require('../..')
const { test, expect } = require('@jest/globals')
const { httpRequest } = require('./helpers/client-request')
nock.disableNetConnect()

const name = 't102'

test(`(${name}) check msw client request interceptors can re-apply across modules`, async () => {
  // proves that the nock module instance hasn't been shared between the two tests:
  expect(nock).not.toHaveProperty('setByTest')
  const scope = nock('http://example.com').get('/foo').reply(200, name)

  const { data, status } = await httpRequest('http://example.com/foo')
  expect(data).toBe(name)
  expect(status).toBe(200)
  scope.done()
  nock.cleanAll()
})
