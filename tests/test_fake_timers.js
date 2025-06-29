'use strict'

const sinon = require('sinon')
const { expect } = require('chai')
const nock = require('..')

describe('test fake timers (sinon)', () => {
  const url = 'https://api.example.com'

  describe('sinon', () => {
    let scope
    let clock

    beforeEach(() => {
      clock = sinon.useFakeTimers()

      scope = nock(url)
        .get('/api/v1/resource')
        .times(3)
        .reply(
          429,
          { message: 'Too many requests' },
          { 'content-type': 'application/json' },
        )
        .get('/api/v1/resource')
        .reply(
          200,
          { message: 'Success' },
          { 'content-type': 'application/json' },
        )
    })

    afterEach(() => {
      clock.restore()
      nock.cleanAll()
      nock.restore()
    })

    it('should use fake timers', async () => {
      const fetch = createRetryFetch({ retries: 3, delay: 100 })

      const promise = fetch(new URL('/api/v1/resource', url))

      await clock.tickAsync(100) // first request
      await clock.tickAsync(100) // first retry
      await clock.tickAsync(100) // second retry
      await clock.tickAsync(100) // third retry

      const response = await promise.then(response => response.json())

      expect(response).to.be.deep.equal({ message: 'Success' })

      scope.done()
    })
  })
})

function createRetryFetch(options = {}) {
  const { retries = 3, delay = 100 } = options

  return async function fetchWithRetry(url, fetchOptions = {}) {
    let currentAttempt = 0

    while (currentAttempt <= retries) {
      const response = await fetch(url, fetchOptions)

      if (!response.ok) {
        await new Promise(resolve => setTimeout(resolve, delay))
        currentAttempt++
        continue
      }

      return response // Success or non-retryable error
    }

    throw new Error('Fetch request failed after multiple retries.')
  }
}
