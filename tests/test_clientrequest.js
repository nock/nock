'use strict'

const http = require('http')
const { test } = require('tap')
const nock = require('../.')

require('./cleanup_after_each')()

// This test seems to need `http`.
test('can use ClientRequest using GET', t => {
  let dataCalled = false

  const scope = nock('http://example.test')
    .get('/dsad')
    .reply(202, 'HEHE!')

  const req = new http.ClientRequest({
    host: 'example.test',
    path: '/dsad',
  })
  req.end()

  req.on('response', function(res) {
    t.equal(res.statusCode, 202)
    res.on('end', function() {
      t.ok(dataCalled, 'data event was called')
      scope.done()
      t.end()
    })
    res.on('data', function(data) {
      dataCalled = true
      t.ok(data instanceof Buffer, 'data should be buffer')
      t.equal(data.toString(), 'HEHE!', 'response should match')
    })
  })

  req.end()
})

// This test seems to need `http`.
test('can use ClientRequest using POST', t => {
  let dataCalled = false

  const scope = nock('http://example.test')
    .post('/posthere/please', 'heyhey this is the body')
    .reply(201, 'DOOONE!')

  const req = new http.ClientRequest({
    host: 'example.test',
    path: '/posthere/please',
    method: 'POST',
  })
  req.write('heyhey this is the body')
  req.end()

  req.on('response', function(res) {
    t.equal(res.statusCode, 201)
    res.on('end', function() {
      t.ok(dataCalled, 'data event was called')
      scope.done()
      t.end()
    })
    res.on('data', function(data) {
      dataCalled = true
      t.ok(data instanceof Buffer, 'data should be buffer')
      t.equal(data.toString(), 'DOOONE!', 'response should match')
    })
  })

  req.end()
})

// This test needs `http`.
test('direct use of ClientRequest executes optional callback', async t => {
  t.plan(1)

  const scope = nock('http://example.test')
    .get('/')
    .reply(201)

  const reqOpts = {
    host: 'example.test',
    path: '/',
    method: 'GET',
  }
  const req = new http.ClientRequest(reqOpts, res => {
    t.is(res.statusCode, 201)
  })
  req.end()

  scope.done()
})

test('creating ClientRequest with empty options throws expected error', t => {
  t.throws(() => new http.ClientRequest(), {
    message:
      'Creating a ClientRequest with empty `options` is not supported in Nock',
  })

  t.end()
})

test('when no interceptors and net connect is allowed, request via ClientRequest goes through', t => {
  const server = http.createServer((request, response) => {
    response.writeHead(201)
    response.end()
  })
  t.once('end', () => server.close())

  server.listen(() => {
    const req = new http.ClientRequest({ port: server.address().port })
    req.on('response', res => {
      t.equal(res.statusCode, 201)
      t.end()
    })
    req.end()
  })
})

test('when no interceptors and net connect is disallowed, receive via ClientRequest emits the expected error', t => {
  nock.disableNetConnect()
  new http.ClientRequest({ port: 12345, path: '/' }).on('error', err => {
    t.equal(err.message, 'Nock: Disallowed net connect for "localhost:12345/"')
    t.end()
  })
})
