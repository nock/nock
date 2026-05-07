import { expect } from 'chai'
import nock from '../../index.ts'
import got from './got_client.js'

it('url encoding', async () => {
  const scope = nock('http://example.test').get('/key?a=[1]').reply(200)

  const { statusCode } = await got('http://example.test/key?a=[1]')
  expect(statusCode).to.equal(200)

  scope.done()
})
