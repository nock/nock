'use strict'

const { expect } = require('chai')
const http = require('http')
const nock = require('..')

const got = require('./got_client')
const httpsServer = require('./servers')

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
    const { origin } = await httpsServer.startHttpsServer(
      (request, response) => {
        response.writeHead(200)
        response.end(responseBody)
      }
    )

    const scope = nock(origin, { allowUnmocked: true })
      .get('/')
      .reply(200, 'mock')

    const { body } = await got(origin, {
      https: { certificateAuthority: httpsServer.ca },
    })
    expect(body).to.equal(responseBody)
    scope.done()
  })

  it('when true before import, Nock does not activate', async () => {
    nock.restore()
    const originalClient = http.ClientRequest

    delete require.cache[require.resolve('..')]
    const newNock = require('..')

    expect(http.ClientRequest).to.equal(originalClient)
    expect(newNock.isActive()).to.equal(false)
  })
})
