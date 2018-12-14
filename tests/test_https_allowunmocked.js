<<<<<<< HEAD
'use strict'

const test = require('tap').test
const fs = require('fs')
const https = require('https')
const nock = require('../')
const request = require('request')

nock.enableNetConnect()

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
    res.end({ status: 'default' })
  })

  server.listen(() => {
    const port = server.address().port
    const url = `https://127.0.0.1:${port}`
    nock(url, { allowUnmocked: true })
      .get('/')
      .query(false)
      .reply(201, { hello: 'there' })

      const options = {
        method: 'GET',
        uri: url
      }

    request(options, (error, response, body) => {
      test.true((error === null), 'should be no error')
      test.true(typeof body !== 'undefined', 'body should not be undefined')
      test.true(body.length !== 0, 'body should not be empty')
      test.end()
    })

    server.close()
  })
})