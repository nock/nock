'use strict'

const http = require('node:http')
const { tmpdir } = require('node:os')
const nock = require('..')
const { expect } = require('chai')
const fs = require('node:fs')
const path = require('node:path')

const socketPath = path.join(tmpdir(), 'socket.sock')
let server

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

describe('Unix socket', () => {
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
