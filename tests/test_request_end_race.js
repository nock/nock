import { expect } from 'chai'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Regression test for https://github.com/nock/nock/issues/3027
//
// A client that knows the request body length up front (e.g. got 16 sets
// `Content-Length`) writes the body and calls `req.end()` in separate
// steps. The mocked response used to be delivered in between, while
// `req.writableEnded` is still false. Clients that treat "response before
// my own end()" as an aborted request (got 16 does) then destroy the
// request and fail with "The server aborted pending request" (ECONNRESET).
//
// The scenario runs in a child process so the regression is verified with
// fresh module state, exactly as an end user would hit it — the state of
// previously-run tests in this process cannot interfere.
describe('Delayed request body completion', () => {
  it('should not deliver a response before the request has finished writing', function (done) {
    this.timeout(10000)

    const repoRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..')
    const scenario = `
import http from 'node:http'
import nock from ${JSON.stringify(path.join(repoRoot, 'index.ts'))}

nock.disableNetConnect()
nock('http://request-end-race.test')
  .post('/c', { c: 'd' })
  .reply(200, { ok: true })

const body = JSON.stringify({ c: 'd' })
const req = new http.ClientRequest({
  host: 'request-end-race.test',
  path: '/c',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  },
})

req.on('response', res => {
  // The mocked response must not be delivered before the client has
  // finished writing the request.
  if (!req.writableEnded) {
    console.error('FAIL: response delivered before req.end()')
    process.exit(1)
  }
  res.resume()
  res.on('end', () => process.exit(0))
})
req.on('error', err => {
  console.error('FAIL:', err.message)
  process.exit(1)
})

// Same write pattern as got 16: body chunk first, end() on a later tick.
req.write(body, 'utf8', () => setImmediate(() => req.end()))
setTimeout(() => {
  console.error('FAIL: no response within timeout')
  process.exit(1)
}, 2000)
`

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nock-regression-'))
    const scenarioPath = path.join(tmpDir, 'scenario.mjs')
    fs.writeFileSync(scenarioPath, scenario)

    const child = spawn(process.execPath, [scenarioPath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    child.on('close', code => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
      expect(code, `child scenario failed:\n${output}`).to.equal(0)
      done()
    })
  })
})
