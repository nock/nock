'use strict'

const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')
const ssl = require('./ssl')

require('./setup')

describe('NOCK_OFF env var', () => {
  let original
  beforeEach(() => {
    original = process.env.NOCK_OFF
    process.env.NOCK_OFF = 'true'
  })
  afterEach(() => {
    process.env.NOCK_OFF = original
  })

  let server
  afterEach(() => {
    if (server) {
      server.close()
      server = undefined
    }
  })

  it('when true, https mocks reach the live server', async () => {
    const responseBody = 'the real thing'
    server = await ssl.startServer((request, response) => {
      response.writeHead(200)
      response.end(responseBody)
    })

    const { port } = server.address()
    const scope = nock(`https://localhost:${port}`, { allowUnmocked: true })
      .get('/')
      .reply(200, 'mock')

    const { body } = await got(`https://localhost:${port}`, { ca: ssl.ca })
    expect(body).to.equal(responseBody)
    scope.done()
  })
})
