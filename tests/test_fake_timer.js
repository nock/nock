'use strict'

const { expect } = require('chai')
const request = require('request')
const fakeTimers = require('@sinonjs/fake-timers')
const nock = require('..')

require('./setup')

// https://github.com/nock/nock/issues/1334
it('should still return successfully when fake timer is enabled', (done) => {
  const clock = fakeTimers.install()
  nock('http://example.test').get('/').reply(200)

  request.get('http://example.test', function (err, resp) {
    clock.uninstall()

    expect(err).to.be.null()
    expect(resp.statusCode).to.equal(200)
    done()
  })
})
