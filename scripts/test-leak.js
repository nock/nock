#!/usr/bin/env node
// Verify nock doesn't leak memory after cleanAll + restore.

import nock from '../index.ts'

global.gc()
const before = process.memoryUsage().heapUsed

for (let i = 0; i < 1000; i++) {
  nock('http://leak-test.local').get('/').reply(200)
  nock.cleanAll()
}
nock.restore()

global.gc()
await new Promise((r) => setTimeout(r, 100))
global.gc()

const after = process.memoryUsage().heapUsed
const growth = after - before

console.log(growth);

// Allow up to 2MB of growth (generous threshold)
if (growth > 2 * 1024 * 1024) {
  console.error(`Memory leak: heap grew by ${(growth / 1024 / 1024).toFixed(1)}MB after 1000 mock cycles`)
  process.exit(1)
}

console.log('Leak test passed')
