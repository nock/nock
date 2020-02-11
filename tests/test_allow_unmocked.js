'use strict'

const http = require('http')
const { expect } = require('chai')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('with allowUnmocked, mocked request still works', async () => {
  const scope = nock('http://example.test', { allowUnmocked: true })
    .post('/')
    .reply(200, '99problems')

  const { body, statusCode } = await got.post('http://example.test/')
  expect(statusCode).to.equal(200)
  expect(body).to.equal('99problems')

  scope.done()
})

test('allow unmocked works after one interceptor is removed', async t => {
  const server = http.createServer((request, response) => {
    response.write('live')
    response.end()
  })
  t.once('end', () => server.close())

  await new Promise(resolve => server.listen(resolve))

  const url = `http://localhost:${server.address().port}`

  nock(url, { allowUnmocked: true })
    .get('/')
    .reply(200, 'Mocked')

  expect((await got(url)).body).to.equal('Mocked')
  expect((await got(url)).body).to.equal('live')
})

test('allow unmocked option allows traffic to server', async t => {
  const server = http.createServer((request, response) => {
    switch (request.url) {
      case '/':
        response.writeHead(200)
        response.write('server served a response')
        break
      case '/not/available':
        response.writeHead(404)
        break
      case '/abc':
        response.writeHead(200)
        response.write('server served a response')
        break
    }

    response.end()
  })

  await new Promise(resolve => server.listen(resolve))
  t.once('end', () => server.close())

  const baseUrl = `http://localhost:${server.address().port}`
  const scope = nock(baseUrl, { allowUnmocked: true })
    .get('/abc')
    .reply(304, 'served from our mock')
    .get('/wont/get/here')
    .reply(304, 'served from our mock')
  const client = got.extend({ baseUrl, throwHttpErrors: false })

  const response1 = await client(`${baseUrl}/abc`)
  expect(response1.statusCode).to.equal(304)
  expect(response1.body).to.equal('served from our mock')
  expect(scope.isDone()).to.equal(false)

  const response2 = await client(`${baseUrl}/not/available`)
  expect(response2.statusCode).to.equal(404)
  expect(scope.isDone()).to.equal(false)

  const response3 = await client(`${baseUrl}/`)
  expect(response3.statusCode).to.equal(200)
  expect(response3.body).to.equal('server served a response')
  expect(scope.isDone()).to.equal(false)
})

test('allow unmocked post with json data', async t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.write('{"message":"server response"}')
    response.end()
  })

  await new Promise(resolve => server.listen(resolve))
  t.once('end', () => server.close())

  const url = `http://localhost:${server.address().port}`
  nock(url, { allowUnmocked: true })
    .get('/not/accessed')
    .reply(200, '{"message":"mocked response"}')

  const { body, statusCode } = await got.post(url, {
    json: { some: 'data' },
    responseType: 'json',
  })
  expect(statusCode).to.equal(200)
  expect(body).to.deep.equal({ message: 'server response' })
})

test('allow unmocked passthrough with mismatched bodies', async t => {
  const server = http.createServer((request, response) => {
    response.writeHead(200)
    response.write('{"message":"server response"}')
    response.end()
  })

  await new Promise(resolve => server.listen(resolve))
  t.once('end', () => server.close())

  const url = `http://localhost:${server.address().port}`
  nock(url, { allowUnmocked: true })
    .post('/post', { some: 'other data' })
    .reply(404, '{"message":"server response"}')

  const { body, statusCode } = await got.post(`${url}/post`, {
    json: { some: 'data' },
    responseType: 'json',
  })
  expect(statusCode).to.equal(200)
  expect(body).to.deep.equal({ message: 'server response' })
})

test('match path using regexp with allowUnmocked', async () => {
  const scope = nock('http://example.test', { allowUnmocked: true })
    .get(/regex$/)
    .reply(200, 'Match regex')

  const { body, statusCode } = await got('http://example.test/resources/regex')
  expect(statusCode).to.equal(200)
  expect(body).to.equal('Match regex')

  scope.done()
})

test('match hostname using regexp with allowUnmocked (issue-1076)', async () => {
  const scope = nock(/localhost/, { allowUnmocked: true })
    .get('/no/regex/here')
    .reply(200, 'Match regex')

  const { body, statusCode } = await got('http://localhost:3000/no/regex/here')
  expect(statusCode).to.equal(200)
  expect(body).to.equal('Match regex')

  scope.done()
})

// https://github.com/nock/nock/issues/1867
test('match path using callback with allowUnmocked', async t => {
  const scope = nock('http://example.test', { allowUnmocked: true })
    .get(uri => uri.endsWith('bar'))
    .reply()

  const { statusCode } = await got('http://example.test/foo/bar')
  expect(statusCode).to.equal(200)

  scope.done()
})

// https://github.com/nock/nock/issues/835
test('match multiple paths to domain using regexp with allowUnmocked', async t => {
  const server = http.createServer((request, response) => {
    response.write('live')
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const url = `http://localhost:${server.address().port}`

  const scope1 = nock(/localhost/, { allowUnmocked: true })
    .get(/alpha/)
    .reply(200, 'this is alpha')

  const scope2 = nock(/localhost/, { allowUnmocked: true })
    .get(/bravo/)
    .reply(200, 'bravo, bravo!')

  expect((await got(`${url}`)).body).to.equal('live')
  expect((await got(`${url}/alphalicious`)).body).to.equal('this is alpha')
  expect((await got(`${url}/bravo-company`)).body).to.equal('bravo, bravo!')

  scope1.done()
  scope2.done()
})

test('match domain and path with literal query params and allowUnmocked', async t => {
  const scope = nock('http://example.test', { allowUnmocked: true })
    .get('/foo?bar=baz')
    .reply()

  const { statusCode } = await got('http://example.test/foo?bar=baz')

  expect(statusCode).to.equal(200)
  scope.done()
})

test('match domain and path using regexp with query params and allowUnmocked', async t => {
  const imgResponse = 'Matched Images Page'

  const scope = nock(/example/, { allowUnmocked: true })
    .get(/imghp\?hl=en/)
    .reply(200, imgResponse)

  const { body, statusCode } = await got('http://example.test/imghp?hl=en')
  expect(statusCode).to.equal(200)
  expect(body).to.equal(imgResponse)

  scope.done()
})

// https://github.com/nock/nock/issues/490
test('match when query is specified with allowUnmocked', async t => {
  const server = http.createServer((request, response) => {
    response.write('live')
    response.end()
  })
  t.once('end', () => server.close())
  await new Promise(resolve => server.listen(resolve))
  const url = `http://localhost:${server.address().port}`

  const scope = nock(url, { allowUnmocked: true })
    .get('/search')
    .query({ q: 'cat pictures' })
    .reply(200, '😻')

  expect((await got(url)).body).to.equal('live')
  expect((await got(`${url}/search?q=cat%20pictures`)).body).to.equal('😻')

  scope.done()
})
