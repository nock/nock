'use strict'

const nock = require('../..')
const { test } = require('@jest/globals')

// jest --detectLeaks flag will fail on a leak, so we do not need any 'expect' in this test
test('Does not leak memory in Jest after using "nock.restore"', () => {
  nock.restore()
})
