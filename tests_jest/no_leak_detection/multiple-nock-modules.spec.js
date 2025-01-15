'use strict'

const { test, expect, jest: _jest } = require('@jest/globals')
const { httpRequest } = require('./helpers/client-request')
/*

There was a bug which caused MSW interceptors not to be applied correctly:
https://github.com/mswjs/interceptors/pull/697
https://github.com/nock/nock/pull/2824
https://github.com/nock/nock/issues/2802

When using jest, each test will get a new instance of the nock module.
if the bug is present the second request will fail to intercept a client request with this error:

> NetConnectNotAllowedError: Nock: Disallowed net connect for "example.com:80/foo"
 */
async function importNockAndDoClientRequest(resBody) {
  _jest.resetModules()
  const nock = require('../..')
  nock.disableNetConnect()
  expect(nock).not.toHaveProperty('moduleAlreadyLoaded')
  nock.moduleAlreadyLoaded = true
  const scope = nock('http://example.com').get('/foo').reply(200, resBody)

  const { data, status } = await httpRequest('http://example.com/foo')
  expect(data).toBe(resBody)
  expect(status).toBe(200)
  scope.done()
  return nock
}

test(`check msw client request interceptors can re-apply across modules`, async () => {
  const nockModule1 = await importNockAndDoClientRequest('one')
  nockModule1.cleanAll()
  const nockModule2 = await importNockAndDoClientRequest('two')
  nockModule1.restore()
  nockModule2.restore()
  _jest.resetModules()
})
