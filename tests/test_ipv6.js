'use strict'

const { test } = require('tap')
const http = require('http')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')

require('./cleanup_after_each')()
require('./setup')

test('IPV6 URL in http.get get gets mocked', t => {
  const responseBody = 'Hello World!'
  const scope = nock('http://[2607:f0d0:1002:51::4]:8080')
    .get('/')
    .reply(200, responseBody)

  http.get('http://[2607:f0d0:1002:51::4]:8080/', res => {
    expect(res).to.include({ statusCode: 200 })
    const onData = sinon.spy()
    res.on('data', data => {
      onData()
      expect(data).to.be.an.instanceOf(Buffer)
      expect(data.toString()).to.equal(responseBody)
    })
    res.on('end', () => {
      expect(onData).to.have.been.calledOnce()
      scope.done()
      t.end()
    })
  })
})

test('IPV6 hostname in http.request get gets mocked', t => {
  const responseBody = 'Hello World!'
  const scope = nock('http://[2607:f0d0:1002:51::5]:8080')
    .get('/')
    .reply(200, responseBody)

  http
    .request(
      {
        hostname: '2607:f0d0:1002:51::5',
        path: '/',
        method: 'GET',
        port: 8080,
      },
      res => {
        expect(res).to.include({ statusCode: 200 })
        const onData = sinon.spy()
        res.on('data', data => {
          onData()
          expect(data).to.be.an.instanceOf(Buffer)
          expect(data.toString()).to.equal(responseBody)
        })
        res.on('end', () => {
          expect(onData).to.have.been.calledOnce()
          scope.done()
          t.end()
        })
      }
    )
    .end()
})
