'use strict'

const { expect } = require('chai')
const http = require('http')
const https = require('https')
const { Readable } = require('stream')
const nock = require('..')

it('should expose TLSSocket attributes for HTTPS requests', done => {
  nock('https://example.test').get('/').reply()

  https.get('https://example.test').on('socket', socket => {
    expect(socket.authorized).to.equal(true)
    expect(socket.encrypted).to.equal(true)
    done()
  })
})

it('should not have TLSSocket attributes for HTTP requests', done => {
  nock('http://example.test').get('/').reply()

  http.get('http://example.test').on('socket', socket => {
    expect(socket.authorized).to.equal(undefined)
    expect(socket.encrypted).to.equal(undefined)
    done()
  })
})

describe('`Socket#setTimeout()`', () => {
  it('adds callback as a one-time listener for parity with a real socket', done => {
    nock('http://example.test').get('/').delayConnection(100).reply()

    const onTimeout = () => {
      done()
    }

    http.get('http://example.test').on('socket', socket => {
      socket.setTimeout(50, onTimeout)
    })
  })

  it('can be called without a callback', done => {
    nock('http://example.test').get('/').delayConnection(100).reply()

    http.get('http://example.test').on('socket', socket => {
      socket.setTimeout(50)

      socket.on('timeout', () => {
        done()
      })
    })
  })
})

describe('`Socket#destroy()`', () => {
  it('can destroy the socket if stream is not finished', async () => {
    const scope = nock('http://example.test')

    scope.intercept('/somepath', 'GET').reply(() => {
      const buffer = Buffer.allocUnsafe(10000000)
      const data = new MemoryReadableStream(buffer, { highWaterMark: 128 })
      return [200, data]
    })

    const req = http.get('http://example.test/somepath')
    const stream = await new Promise(resolve => req.on('response', resolve))

    // close after first chunk of data
    stream.on('data', () => stream.destroy())

    await new Promise((resolve, reject) => {
      stream.on('error', reject)
      stream.on('close', resolve)
      stream.on('end', resolve)
    })
  })
})

class MemoryReadableStream extends Readable {
  constructor(content) {
    super()
    this._content = content
    this._currentOffset = 0
  }

  _read(size) {
    if (this._currentOffset >= this._content.length) {
      this.push(null)
      return
    }

    const nextOffset = this._currentOffset + size
    const content = this._content.slice(this._currentOffset, nextOffset)
    this._currentOffset = nextOffset

    this.push(content)
  }
}
