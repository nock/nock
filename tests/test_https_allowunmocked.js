'use strict'

const { test } = require('tap')
const fs = require('fs')
const https = require('https')
const nock = require('../')
const got = require('got')

nock.enableNetConnect()

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

test('Nock with allowUnmocked and an url match', async test => {
  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt'),
  }

  const server = https.createServer(options, (req, res) => {
    res.writeHead(200)
    res.end({ status: 'default' })
  })

  server.listen(3000)

  const url = `https://127.0.0.1:${server.address().port}`

  nock(url, { allowUnmocked: true })
    .get('/urlMatch')
    .reply(201, JSON.stringify({ status: 'intercepted' }))

  try {
    const { body, statusCode } = await got(`${url}/urlMatch`)
    test.true(statusCode === 201)
    test.true(JSON.parse(body).status === 'intercepted')
  } catch (error) {
    console.warn(error)
  }

  test.end()
  server.close()
})

test('Nock with allowUnmocked, url match and query false', async test => {
  nock.cleanAll()

  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt'),
  }

  const server = https.createServer(options, (req, res) => {
    res.writeHead(200)
    res.end(JSON.stringify({ status: 'default' }))
  })

  server.listen(3000)

  const url = `https://127.0.0.1:3000`

  nock(`${url}`, { allowUnmocked: true })
    .get('/')
    .query(false)
    .reply(200, { status: 'intercepted' })

  try {
    const { body } = await got(`${url}/otherpath`)
    test.true(JSON.parse(body).status === 'default')
  } catch (error) {
    console.warn(error)
  }

  test.end()
  server.close()
})
