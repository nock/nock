'use strict'

const nock = require('../')
const {
  test,
  beforeEach,
  afterEach,
  expect,
  describe,
} = require('@jest/globals')

describe('A basic test with jest', () => {
  beforeEach(() => {
    nock('https://www.nock.com').post('/nock').reply(200, { test: '1' })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  test.each(Array.from({ length: 10 }))('%s test', async () => {
    const response = await fetch('https://www.nock.com/nock', {
      method: 'post',
    })

    expect(await response.json()).toEqual({ test: '1' })
  })

  test('should fail when net connect is disabled', async () => {
    nock.disableNetConnect()
    try {
      await fetch('https://www.unnocked.com', {
        method: 'post',
      })
    } catch (error) {
      expect(error.message).toEqual(
        'Nock: Disallowed net connect for "www.unnocked.com:443/"',
      )
    }
  })
})
