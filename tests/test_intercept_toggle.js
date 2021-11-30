'use strict'

const { expect } = require('chai')
const nock = require('..')

const got = require('./got_client')
const servers = require('./servers')

// Tests for unnocking via "enabled" property

describe('toggling interceptors', () => {
  it('interceptor is enabled', async () => {
    const { origin } = await servers.startHttpServer((req, res) => {
      res.json(JSON.stringify({ status: false }))
    })

    const interceptor = nock(`${origin}/`)

    interceptor.get('/').reply(200, { status: true })

    let { body } = await got(`${origin}/`)

    body = JSON.parse(body)

    expect(body.status).to.equal(true)
  })

  it('interceptor is disabled', async () => {
    const { origin } = await servers.startHttpServer((req, res) => {
      res.writeHead(200)
      res.end(JSON.stringify({ status: false }))
    })

    const interceptor = nock(`${origin}/`)

    interceptor.enabled = false

    let { body } = await got(`${origin}/`)

    body = JSON.parse(body)

    expect(body.status).to.equal(false)
  })
})
