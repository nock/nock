import { expect } from 'chai'
import http from 'node:http'
import nock from '../../index.ts'

import got from './got_client.js'
import { startHttpsServer, ca } from '../servers/index.js'

describe('NOCK_OFF env var', () => {
  let original

  beforeEach(() => {
    original = process.env.NOCK_OFF
    process.env.NOCK_OFF = 'true'
  })

  afterEach(() => {
    process.env.NOCK_OFF = original
  })

  it('when true, https mocks reach the live server', async () => {
    const responseBody = 'the real thing'
    const { origin } = await startHttpsServer((request, response) => {
      response.writeHead(200)
      response.end(responseBody)
    })

    const scope = nock(origin, { allowUnmocked: true })
      .get('/')
      .reply(200, 'mock')

    const { body } = await got(origin, {
      https: { certificateAuthority: ca },
    })
    expect(body).to.equal(responseBody)
    scope.done()
  })

  it('when true before import, Nock does not activate', async () => {
    nock.restore()
    const originalClient = http.ClientRequest

    const { default: newNock } = await import('../../index.ts?t=' + Date.now())

    expect(http.ClientRequest).to.equal(originalClient)
    expect(newNock.isActive()).to.equal(false)
  })
})
