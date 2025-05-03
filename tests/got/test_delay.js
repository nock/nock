'use strict'

const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { expect } = require('chai')
const stream = require('stream')
const nock = require('../..')
const got = require('./got_client')

const textFilePath = path.resolve(__dirname, '../assets/reply_file_1.txt')
const textFileContents = fs.readFileSync(textFilePath, { encoding: 'utf8' })

async function resolvesInAtLeast(promise, durationMillis) {
  const startTime = process.hrtime()
  const result = await promise
  checkDuration(startTime, durationMillis)
  return result
}

function checkDuration(start, durationMillis) {
  const hrtime = process.hrtime(start)
  const milliseconds = ((hrtime[0] * 1e9 + hrtime[1]) / 1e6) | 0

  // When asserting delays, we know the code should take at least the delay amount of time to execute,
  // however, the overhead of running the code adds a few milliseconds to anything we are testing.
  // We'd like to test some sort of upper bound too, but that has been problematic with different systems
  // having a wide rage of overhead.
  // We've also seen discrepancies with timings that sometimes result in the passed milliseconds
  // being one shy of the expected duration. Subtracting 5ms makes it more resilient.
  // https://github.com/nock/nock/issues/2045
  // TODO: find a better way to test delays while ensuring the delays aren't too long.
  expect(milliseconds).to.be.at.least(
    durationMillis - 5,
    'delay minimum not satisfied',
  )
  // .and.at.most(durationMillis + bufferMillis, 'delay upper bound exceeded')
}

describe('`delay()`', () => {
  it('should throw on invalid arguments', () => {
    const interceptor = nock('http://example.test').get('/')
    // @ts-expect-error test invalid input
    expect(() => interceptor.delay('one million seconds')).to.throw(
      'Unexpected input',
    )
  })

  // TODO: fix this test, the start should be in the response callback
  it.skip('should delay the clock between the `response` event and the first `data` event', done => {
    nock('http://example.test').get('/').delay(200).reply(201, 'OK')

    const start = process.hrtime()
    http.get('http://example.test', res => {
      res.once('data', () => {
        checkDuration(start, 200)
        done()
      })
    })
  })

  it('should delay the overall response', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delay(200)
      .reply(200, 'OK')

    const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

    expect(body).to.equal('OK')
    scope.done()
  })

  it('should not have an impact on a response timeout', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delay(300)
      .reply(201, 'OK')

    const { body, statusCode } = await got('http://example.test/', {
      timeout: {
        response: 500,
      },
    })

    expect(statusCode).to.equal(201)
    expect(body).to.equal('OK')
    scope.done()
  })

  it('should work with a response stream', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delay(200)
      .reply(200, () => fs.createReadStream(textFilePath, { encoding: 'utf8' }))

    const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

    expect(body).to.equal(textFileContents)
    scope.done()
  })

  it('should work with a response stream of binary buffers', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delay(200)
      // No encoding specified, which causes the file to be streamed using
      // buffers instead of strings.
      .reply(200, () => fs.createReadStream(textFilePath))

    const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

    expect(body).to.equal(textFileContents)
    scope.done()
  })

  it('should work with a delayed response stream', async () => {
    const passthrough = new stream.Transform({
      transform(chunk, encoding, callback) {
        this.push(chunk.toString())
        callback()
      },
    })

    const scope = nock('http://example.test')
      .get('/')
      .delay(100)
      .reply(200, () => passthrough)

    setTimeout(() => fs.createReadStream(textFilePath).pipe(passthrough), 125)

    const { body } = await got('http://example.test/')

    expect(body).to.equal(textFileContents)
    scope.done()
  })
})
