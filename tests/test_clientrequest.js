'use strict'

const { expect } = require('chai')
const http = require('http')
const sinon = require('sinon')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_after_each')()
require('./setup')

// This test seems to need `http`.
test('can use ClientRequest using GET', t => {
  const dataSpy = sinon.spy()

  const scope = nock('http://example.test')
    .get('/dsad')
    .reply(202, 'HEHE!')

  const req = new http.ClientRequest({
    host: 'example.test',
    path: '/dsad',
  })
  req.end()

  req.on('response', function(res) {
    expect(res.statusCode).to.equal(202)
    res.on('end', function() {
      expect(dataSpy).to.have.been.calledOnce()
      scope.done()
      t.end()
    })
    res.on('data', function(data) {
      dataSpy()
      expect(data).to.be.instanceof(Buffer)
      expect(data.toString()).to.equal('HEHE!')
    })
  })

  req.end()
})

// This test seems to need `http`.
test('can use ClientRequest using POST', t => {
  const dataSpy = sinon.spy()

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
    expect(res.statusCode).to.equal(201)
    res.on('end', function() {
      expect(dataSpy).to.have.been.calledOnce()
      scope.done()
      t.end()
    })
    res.on('data', function(data) {
      dataSpy()
      expect(data).to.be.instanceof(Buffer)
      expect(data.toString()).to.equal('DOOONE!')
    })
  })

  req.end()
})

// This test needs `http`.
test('direct use of ClientRequest executes optional callback', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .reply(201)

  const reqOpts = {
    host: 'example.test',
    path: '/',
    method: 'GET',
  }
  const req = new http.ClientRequest(reqOpts, res => {
    expect(res.statusCode).to.equal(201)
    t.done()
  })
  req.end()

  scope.done()
})

test('creating ClientRequest with empty options throws expected error', t => {
  expect(() => new http.ClientRequest()).to.throw(
    'Creating a ClientRequest with empty `options` is not supported in Nock'
  )

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
      expect(res.statusCode).to.equal(201)
      t.end()
    })
    req.end()
  })
})

test('when no interceptors and net connect is disallowed, receive via ClientRequest emits the expected error', t => {
  nock.disableNetConnect()
  new http.ClientRequest({ port: 12345, path: '/' }).on('error', err => {
    expect(err.message).to.equal(
      'Nock: Disallowed net connect for "localhost:12345/"'
    )
    t.end()
  })
})
