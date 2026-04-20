import http from 'node:http'
import { tmpdir } from 'node:os'
import nock from '../index.ts'
import { expect } from 'chai'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const socketPath = path.join(tmpdir(), 'socket.sock')
let server

const isWindows = os.platform() === 'win32'

// Skipping Unix socket tests on Windows
if (!isWindows) {

describe('Unix socket', () => {
  before(async () => {
    server = http.createServer((req, res) => {
      res.end('hello world')
    })

    await new Promise((resolve, reject) => {
      server.listen(socketPath, err => {
        if (err) reject(err)
        else resolve()
      })
    })
  })

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close(err => {
        if (err) reject(err)
        else resolve()
      })
    })

    try {
      fs.unlinkSync(socketPath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  })

  it('dispatches a GET request to a Unix socket', async () => {
    const response = await new Promise((resolve, reject) => {
      const request = http.get(
        {
          socketPath,
          path: '/test-get',
        },
        res => {
          let data = ''
          res.on('data', chunk => (data += chunk))
          res.on('end', () => resolve(data))
        },
      )

      request.on('error', reject)
    })

    expect(response).to.equal('hello world')
  })

  it('intercepts a GET request to a Unix socket', async () => {
    nock('http://unix:').get('/test-get').reply(200, 'hello world')

    const response = await new Promise((resolve, reject) => {
      const request = http.get(
        {
          socketPath,
          path: '/test-get',
        },
        res => {
          let data = ''
          res.on('data', chunk => (data += chunk))
          res.on('end', () => resolve(data))
        },
      )

      request.on('error', reject)
    })

    expect(response).to.equal('hello world')
  })
})
}
