'use strict'

const fs = require('fs')
const { expect } = require('chai')
const path = require('path')
const http = require('http')
const stream = require('stream')
const assertRejects = require('assert-rejects')
const sinon = require('sinon')
const { test } = require('tap')
const nock = require('..')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

const textFilePath = path.resolve(__dirname, './assets/reply_file_1.txt')
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
  // having a wide rage of overhead
  // TODO: find a better way to test delays while ensuring the delays aren't too long.
  expect(milliseconds).to.be.at.least(
    durationMillis,
    'delay minimum not satisfied'
  )
  // .and.at.most(durationMillis + bufferMillis, 'delay upper bound exceeded')
}

test('calling delay could cause timeout error', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delay({
      head: 300,
    })
    .reply(200, 'OK')

  await assertRejects(
    got('http://example.test', { timeout: 100 }),
    err => err.code === 'ETIMEDOUT'
  )

  scope.done()
})

test('Body delay does not have impact on timeout', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delay({
      head: 300,
      body: 300,
    })
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

test('calling delay with "body" and "head" delays the response', t => {
  nock('http://example.test')
    .get('/')
    .delay({
      head: 200,
      body: 300,
    })
    .reply(200, 'OK')

  const resStart = process.hrtime()

  http.get('http://example.test', res => {
    checkDuration(resStart, 200)

    // const dataStart = process.hrtime()
    res.once('data', function (data) {
      // TODO: there is a bug in Nock that allows this delay to be less than the desired 300ms.
      //  there is a known issues with streams, but this needs further investigation.
      // checkDuration(dataStart, 300)
      expect(data.toString()).to.equal('OK')
      res.once('end', () => t.done())
    })
  })
})

test('calling delay with "body" delays the response body', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delay({ body: 200 })
    .reply(200, 'OK')

  const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

  expect(body).to.equal('OK')
  scope.done()
})

test('calling delayBody delays the response', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delayBody(200)
    .reply(200, 'OK')

  const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

  expect(body).to.equal('OK')
  scope.done()
})

test('delayBody works with a stream', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delayBody(200)
    .reply(200, () => fs.createReadStream(textFilePath, { encoding: 'utf8' }))

  const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

  expect(body).to.equal(textFileContents)
  scope.done()
})

test('delayBody works with a stream of binary buffers', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delayBody(200)
    // No encoding specified, which causes the file to be streamed using
    // buffers instead of strings.
    .reply(200, () => fs.createReadStream(textFilePath))

  const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

  expect(body).to.equal(textFileContents)
  scope.done()
})

test('delayBody works with a delayed stream', async () => {
  const passthrough = new stream.Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk.toString())
      callback()
    },
  })

  const scope = nock('http://example.test')
    .get('/')
    .delayBody(100)
    .reply(200, () => passthrough)

  setTimeout(() => fs.createReadStream(textFilePath).pipe(passthrough), 125)

  const { body } = await got('http://example.test/')

  expect(body).to.equal(textFileContents)
  scope.done()
})

test('calling delay delays the response', async () => {
  const scope = nock('http://example.test').get('/').delay(200).reply(200, 'OK')

  const { body } = await resolvesInAtLeast(got('http://example.test'), 200)

  expect(body).to.equal('OK')
  scope.done()
})

test('using reply callback with delay provides proper arguments', async () => {
  const replyStub = sinon.stub().returns('')

  const scope = nock('http://example.test')
    .post('/')
    .delay(100)
    .reply(200, replyStub)

  await got.post('http://example.test', { body: 'OK' })

  expect(replyStub).to.have.been.calledOnceWithExactly('/', 'OK')
  scope.done()
})

test('using reply callback with delay can reply JSON', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delay(100)
    .reply(200, () => ({ a: 1 }))

  const { body, headers, statusCode } = await got('http://example.test')

  expect(body).to.equal('{"a":1}')
  expect(headers).to.have.property('content-type', 'application/json')
  expect(statusCode).to.equal(200)
  scope.done()
})

test('delay with invalid arguments', t => {
  const interceptor = nock('http://example.test').get('/')

  expect(() => interceptor.delay('one million seconds')).to.throw(
    'Unexpected input'
  )
  t.end()
})

test('delay works with replyWithFile', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delay(200)
    .replyWithFile(200, textFilePath)

  const { body, statusCode } = await resolvesInAtLeast(
    got('http://example.test'),
    200
  )

  expect(statusCode).to.equal(200)
  expect(body).to.equal(textFileContents)
  scope.done()
})

test('delay works with when you return a generic stream from the reply callback', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delay(200)
    .reply(200, () => fs.createReadStream(textFilePath))

  const { body, statusCode } = await resolvesInAtLeast(
    got('http://example.test'),
    200
  )

  expect(statusCode).to.equal(200)
  expect(body).to.equal(textFileContents)
  scope.done()
})

test('delay with replyWithError: response is delayed', async () => {
  nock('http://example.test')
    .get('/')
    .delay(100)
    .replyWithError('this is an error message')

  await resolvesInAtLeast(
    assertRejects(got('http://example.test'), /this is an error message/),
    100
  )
})

test('calling delayConnection delays the connection', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delayConnection(200)
    .reply(200, 'OK')

  const { body } = await resolvesInAtLeast(got('http://example.test'), 200)

  expect(body).to.equal('OK')
  scope.done()
})

test('using reply callback with delayConnection provides proper arguments', async () => {
  const replyStub = sinon.stub().returns('')

  const scope = nock('http://example.test')
    .post('/')
    .delayConnection(100)
    .reply(200, replyStub)

  await got.post('http://example.test', { body: 'OK' })

  expect(replyStub).to.have.been.calledOnceWithExactly('/', 'OK')
  scope.done()
})

test('delayConnection works with replyWithFile', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delayConnection(200)
    .replyWithFile(200, textFilePath)

  const { body } = await resolvesInAtLeast(got('http://example.test'), 200)

  expect(body).to.equal(textFileContents)
  scope.done()
})

test('delayConnection works with when you return a generic stream from the reply callback', async () => {
  const scope = nock('http://example.test')
    .get('/')
    .delayConnection(200)
    .reply(200, () => fs.createReadStream(textFilePath))

  const { body } = await resolvesInAtLeast(got('http://example.test'), 200)

  expect(body).to.equal(textFileContents)
  scope.done()
})

test('request with delayConnection and request.timeout', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .delayConnection(1000)
    .reply(200, {})

  await assertRejects(
    got('http://example.test', { timeout: 10 }),
    err => err.code === 'ETIMEDOUT'
  )

  scope.done()
  t.done()
})
