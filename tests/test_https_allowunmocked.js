'use strict'

const { test } = require('tap')
const fs = require('fs')
const https = require('https')
const nock = require('../')
const got = require('got')

nock.enableNetConnect()

test('Nock with allowUnmocked and an url match', async t => {
  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt'),
  }

  const server = https
    .createServer(options, (req, res) => {
      res.writeHead(200)
      res.end({ status: 'default' })
    })
    .listen(3000)

  const url = `https://127.0.0.1:${server.address().port}`

  nock(url, { allowUnmocked: true })
    .get('/urlMatch')
    .reply(201, JSON.stringify({ status: 'intercepted' }))

  const { body, statusCode } = await got(`${url}/urlMatch`, {
    rejectUnauthorized: false,
  }).catch(e => {
    console.log(e)
  })

  t.true(statusCode === 201)
  t.true(JSON.parse(body).status === 'intercepted')

  server.close()
})

test('Nock with allowUnmocked, url match and query false', async t => {
  nock.cleanAll()

  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt'),
  }

  const server = https
    .createServer(options, (req, res) => {
      res.writeHead(200)
      res.end(JSON.stringify({ status: 'default' }))
    })
    .listen(3000)

  const url = `https://127.0.0.1:3000`

  nock(`${url}`, { allowUnmocked: true })
    .get('/')
    .query(false)
    .reply(200, { status: 'intercepted' })

  const { body } = await got(`${url}/otherpath`, {
    rejectUnauthorized: false,
  }).catch(e => {
    console.log(e)
  })

  t.true(JSON.parse(body).status === 'default')

  server.close()
})
