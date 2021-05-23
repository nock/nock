'use strict'

const { expect } = require('chai')
const zlib = require('zlib')
const nock = require('..')
const got = require('./got_client')

describe('Content Encoding', () => {
  it('should accept gzipped content', async () => {
    const message = 'Lorem ipsum dolor sit amet'
    const compressed = zlib.gzipSync(message)

    const scope = nock('http://example.test')
      .get('/foo')
      .reply(200, compressed, {
        'X-Transfer-Length': String(compressed.length),
        'Content-Length': undefined,
        'Content-Encoding': 'gzip',
      })
    const { body, statusCode } = await got('http://example.test/foo')

    expect(statusCode).to.equal(200)
    expect(body).to.equal(message)
    scope.done()
  })

  it('Delaying the body works with content encoded responses', async () => {
    const message = 'Lorem ipsum dolor sit amet'
    const compressed = zlib.gzipSync(message)

    const scope = nock('http://example.test')
      .get('/')
      .delay({
        body: 100,
      })
      .reply(200, compressed, {
        'Content-Encoding': 'gzip',
      })

    const { statusCode, body } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    expect(body).to.equal(message)
    scope.done()
  })
})
