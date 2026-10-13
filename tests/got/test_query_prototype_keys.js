import { expect } from 'chai'
import nock from '../../index.ts'
import got from './got_client.js'

for (const [label, query] of [
  ['query string', '__proto__=first&__proto__=second'],
  ['URLSearchParams', new URLSearchParams('__proto__=first&__proto__=second')],
  ['query object', JSON.parse('{"__proto__":["first","second"]}')],
]) {
  describe('prototype-named query parameters', () => {
    it(`matches ${label}`, async () => {
      const scope = nock('http://example.test').get('/').query(query).reply(200)
      const { statusCode } = await got(
        'http://example.test/?__proto__=first&__proto__=second',
      )
      expect(statusCode).to.equal(200)
      scope.done()
    })
  })
}
