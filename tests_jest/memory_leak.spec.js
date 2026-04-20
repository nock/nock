import nock from '../index.ts'
import { test } from '@jest/globals'

// jest --detectLeaks flag will fail on a leak, so we do not need any 'expect' in this test
test('Does not leak memory in Jest after using "nock.restore"', () => {
  nock.restore()
})
