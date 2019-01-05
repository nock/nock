'use strict'

const test = require('tap').test
const fs = require('fs')
const https = require('https')
const nock = require('../')
const request = require('request')

const axios = require('axios')

nock.enableNetConnect()
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0

test('Nock with allowUnmocked and an url match', (test) => {
  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt')
  }

  const server = https.createServer(options, (req, res) => {
    res.writeHead(200)
    res.end({ status: 'default' })
  })

  server.listen(() => {
    nock(`https://127.0.0.1:${server.address().port}`, { allowUnmocked: true })
      .get('/urlMatch')
      .reply(201, { status: 'intercepted' })

    const url = `https://127.0.0.1:${server.address().port}/urlMatch`

    request(url, (error, data, body) => {
      test.notOk(error, 'Should be no error')
      test.true(data.statusCode === 201, 'statusCode should match')
      test.true(JSON.parse(body).status === 'intercepted', 'body should match')
      test.end()
    })

    server.close()
  })
})

test('Nock with allowUnmocked, url match and query false', (test) => {
  nock.cleanAll()

  const options = {
    key: fs.readFileSync('tests/ssl/ca.key'),
    cert: fs.readFileSync('tests/ssl/ca.crt')
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

  axios.get(`${url}/otherpath`).then(response => {
    test.true(response.data.status === 'default')
    test.end()
  }).catch(error => {
    test.notOk()
  }).then(_ => {
    server.close()
  })
})
