import fakeTimers from '@sinonjs/fake-timers'
import nock from '../../index.ts'
import got from './got_client.js'

// https://github.com/nock/nock/issues/1334
it('should still return successfully when fake timer is enabled', async () => {
  const clock = fakeTimers.install()
  const scope = nock('http://example.test').get('/').reply()

  await got('http://example.test')

  clock.uninstall()
  scope.done()
})
