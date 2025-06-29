'use strict'

const fakeTimers = require('@sinonjs/fake-timers')
const nock = require('../..')
const got = require('./got_client')

// https://github.com/nock/nock/issues/1334
it('should still return successfully when fake timer is enabled', async () => {
  const clock = fakeTimers.install()
  const scope = nock('http://example.test').get('/').reply()

  const promise = got('http://example.test')

  await clock.runAllAsync() // Run all fake timers to ensure all scheduled tasks are executed

  await promise

  clock.uninstall()
  scope.done()
})
