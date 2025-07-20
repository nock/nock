/* globals jest */ 
'use strict'

const nock = require('../')
const {
  test,
  beforeEach,
  afterEach,
  expect,
  describe,
} = require('@jest/globals')

describe('Jest resetModules clear nock "allInterceptors" state', () => {
  beforeEach(() => {
    nock('https://www.nock.com').post('/nock').reply(200, { test: '1' })
  })

  afterEach(() => {
    jest.resetModules()
    nock.cleanAll()
  })

  test('1st test', async () => {
    const response = await fetch('https://www.nock.com/nock', {
      method: 'post',
    })

    expect(await response.json()).toEqual({ test: '1' })
  })

  test('2nd test with reset modules should pass', async () => {
    const response = await fetch('https://www.nock.com/nock', {
      method: 'post',
    })

    expect(await response.json()).toEqual({ test: '1' })
  })
})
