// Smoke test: verify the built dist/ output is importable and functional.

import { strict as assert } from 'node:assert'
import got from 'got'
import nock from '../dist/index.js'

// Verify main export is a function
assert.equal(typeof nock, 'function')

// Verify key properties are attached
assert.equal(typeof nock.cleanAll, 'function')
assert.equal(typeof nock.disableNetConnect, 'function')
assert.equal(typeof nock.enableNetConnect, 'function')
assert.equal(typeof nock.recorder, 'object')
assert.equal(typeof nock.back, 'function')

// Verify a mock intercepts an HTTP request
const scope = nock('http://smoke-test.local').get('/').reply(200, 'ok')

const { body } = await got('http://smoke-test.local/')

assert.equal(body, 'ok')
assert.ok(scope.isDone())

nock.cleanAll()
console.log('Smoke test passed')
