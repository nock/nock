'use strict'

const { describe, it, beforeEach, afterEach, afterAll } = require('@jest/globals')
const { expect } = require('chai')
const nock = require('..')

describe('test fake timers (jest)', () => {
  const url = 'https://api.example.com'

  afterAll(() => {
    nock.restore();
  })

  describe('using timers to test delays', () => {
    let scope

    beforeEach(() => {
      jest.useFakeTimers()

      scope = nock(url)
        .get('/api/v1/resource')
        .delay(1000)
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
      nock.cleanAll()
      jest.useRealTimers()
    })

    it('correctly trigger the timers', async () => {
      const fetch = createRetryFetch({ retries: 3, delay: 100 })

      const request = fetch(new URL('/api/v1/resource', url))

      await jest.runAllTimersAsync() // first request
      await jest.runAllTimersAsync() // first retry
      await jest.runAllTimersAsync() // second retry
      await jest.runAllTimersAsync() // third retry

      const response = await request.then(async response => response.json());


      expect(response).to.be.deep.equal({ message: 'Success' })

      scope.done()
    })
  })

  describe('advance timers workaround', () => {
    let scope

    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true })

      scope = nock(url)
        .get('/api/v1/resource')
        .reply(
          200,
          { message: 'Success' },
          { 'content-type': 'application/json' },
        )
    })

    afterEach(() => {
      nock.cleanAll()
      jest.useRealTimers()
    })

    it('should use fake timers', async () => {
      const request = fetch(new URL('/api/v1/resource', url))

      const response = await request.then(response => response.json())

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
