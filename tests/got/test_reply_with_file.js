// Tests for `.replyWithFile()`.

import fs from 'node:fs'
import path from 'node:path'
import sinon from 'sinon'
import { expect } from 'chai'
import nock from '../../index.ts'
import got from './got_client.js'

const textFilePath = path.resolve(
  import.meta.dirname,
  '../assets/reply_file_1.txt',
)
const binaryFilePath = path.resolve(
  import.meta.dirname,
  '../assets/reply_file_2.txt.gz',
)

describe('`replyWithFile()`', () => {
  it('reply with file', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .replyWithFile(200, textFilePath)

    const { statusCode, body } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    expect(body).to.equal('Hello from the file!')

    scope.done()
  })

  it('reply with file with headers', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .replyWithFile(200, binaryFilePath, {
        'content-encoding': 'gzip',
      })

    const { statusCode, body } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    expect(body).to.have.lengthOf(20)
    scope.done()
  })

  it('reply with file with repeated', async () => {
    sinon.spy(fs)

    const scope = nock('http://example.test')
      .get('/')
      .times(2)
      .replyWithFile(200, binaryFilePath, {
        'content-encoding': 'gzip',
      })

    const response1 = await got('http://example.test/')
    expect(response1.statusCode).to.equal(200)
    expect(response1.body).to.have.lengthOf(20)

    const response2 = await got('http://example.test/')
    expect(response2.statusCode).to.equal(200)
    expect(response2.body).to.have.lengthOf(20)

    expect(fs.createReadStream.callCount).to.equal(2)

    scope.done()
  })

  it('reply with file with persist', async () => {
    sinon.spy(fs)

    const scope = nock('http://example.test')
      .persist()
      .get('/')
      .replyWithFile(200, binaryFilePath, {
        'content-encoding': 'gzip',
      })

    const response1 = await got('http://example.test/')
    expect(response1.statusCode).to.equal(200)
    expect(response1.body).to.have.lengthOf(20)

    const response2 = await got('http://example.test/')
    expect(response2.statusCode).to.equal(200)
    expect(response2.body).to.have.lengthOf(20)

    expect(fs.createReadStream.callCount).to.equal(2)

    scope.done()
  })

  it('does not create ReadStream eagerly', async () => {
    sinon.spy(fs)

    nock('http://example.test').get('/').replyWithFile(200, binaryFilePath, {
      'content-encoding': 'gzip',
    })

    expect(fs.createReadStream.callCount).to.equal(0)
  })
})
