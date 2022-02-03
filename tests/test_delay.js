'use strict'

const fs = require('fs')
const { expect } = require('chai')
const path = require('path')
const http = require('http')
const stream = require('stream')
const assertRejects = require('assert-rejects')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

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
  // having a wide rage of overhead.
  // We've also seen discrepancies with timings that sometimes result in the passed milliseconds
  // being one shy of the expected duration. Subtracting 5ms makes it more resilient.
  // https://github.com/nock/nock/issues/2045
  // TODO: find a better way to test delays while ensuring the delays aren't too long.
  expect(milliseconds).to.be.at.least(
    durationMillis - 5,
    'delay minimum not satisfied'
  )
  // .and.at.most(durationMillis + bufferMillis, 'delay upper bound exceeded')
}

describe('`delay()`', () => {
  let interceptor
  let connSpy
  let bodySpy

  // As a rule, the tests in this repo have a strategy of only testing the API and not spying on
  // internals for unit tests. These next few tests break that rule to assert the proxy behavior of
  // `delay()`. This is simply to reduce the need of double testing the behavior of `delayBody()`
  // and `delayConnection()` and should not be used as an example for writing new tests.
  beforeEach(() => {
    interceptor = nock('http://example.test').get('/')
    connSpy = sinon.spy(interceptor, 'delayConnection')
    bodySpy = sinon.spy(interceptor, 'delayBody')
  })

  it('should proxy a single number argument', () => {
    interceptor.delay(42)

    expect(connSpy).to.have.been.calledOnceWithExactly(42)
    expect(bodySpy).to.have.been.calledOnceWithExactly(0)
  })

  it('should proxy values from an object argument', () => {
    interceptor.delay({ head: 42, body: 17 })

    expect(connSpy).to.have.been.calledOnceWithExactly(42)
    expect(bodySpy).to.have.been.calledOnceWithExactly(17)
  })

  it('should default missing values from an object argument', () => {
    interceptor.delay({})

    expect(connSpy).to.have.been.calledOnceWithExactly(0)
    expect(bodySpy).to.have.been.calledOnceWithExactly(0)
  })

  it('should throw on invalid arguments', () => {
    expect(() => interceptor.delay('one million seconds')).to.throw(
      'Unexpected input'
    )
  })

  it('should delay the response when called with "body" and "head"', done => {
    nock('http://example.test')
      .get('/')
      .delay({
        head: 200,
        body: 300,
      })
      .reply(200, 'OK')

    const start = process.hrtime()

    http.get('http://example.test', res => {
      checkDuration(start, 200)

      res.once('data', function (data) {
        checkDuration(start, 500)
        expect(data.toString()).to.equal('OK')
        res.once('end', done)
      })
    })
  })
})

describe('`delayBody()`', () => {
  it('should delay the clock between the `response` event and the first `data` event', done => {
    nock('http://example.test').get('/').delayBody(200).reply(201, 'OK')

    http.get('http://example.test', res => {
      const start = process.hrtime()
      res.once('data', () => {
        checkDuration(start, 200)
        done()
      })
    })
  })

  it('should delay the overall response', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayBody(200)
      .reply(200, 'OK')

    const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

    expect(body).to.equal('OK')
    scope.done()
  })

  it('should not have an impact on a response timeout', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(300)
      .delayBody(300)
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
      .delayBody(200)
      .reply(200, () => fs.createReadStream(textFilePath, { encoding: 'utf8' }))

    const { body } = await resolvesInAtLeast(got('http://example.test/'), 200)

    expect(body).to.equal(textFileContents)
    scope.done()
  })

  it('should work with a response stream of binary buffers', async () => {
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

  it('should work with a delayed response stream', async () => {
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
})

describe('`delayConnection()`', () => {
  it('should cause a timeout error when larger than options.timeout', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(1000)
      .reply(200, {})

    await assertRejects(
      got('http://example.test', { timeout: 10 }),
      err => err.code === 'ETIMEDOUT'
    )

    scope.done()
  })

  it('should delay the clock before the `response` event', done => {
    nock('http://example.test').get('/').delayConnection(200).reply()

    const req = http.request('http://example.test', () => {
      checkDuration(start, 200)
      done()
    })

    req.end()
    const start = process.hrtime()
  })

  it('should delay the overall response', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(200)
      .reply(200, 'OK')

    const { body } = await resolvesInAtLeast(got('http://example.test'), 200)

    expect(body).to.equal('OK')
    scope.done()
  })

  it('should provide the proper arguments when using reply a callback', async () => {
    const replyStub = sinon.stub().returns('')

    const scope = nock('http://example.test')
      .post('/')
      .delayConnection(100)
      .reply(200, replyStub)

    await got.post('http://example.test', { body: 'OK' })

    expect(replyStub).to.have.been.calledOnceWithExactly('/', 'OK')
    scope.done()
  })

  it('should delay a JSON response when using a reply callback', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(100)
      .reply(200, () => ({ a: 1 }))

    const { body, headers, statusCode } = await got('http://example.test')

    expect(body).to.equal('{"a":1}')
    expect(headers).to.have.property('content-type', 'application/json')
    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('should work with `replyWithFile()`', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(200)
      .replyWithFile(200, textFilePath)

    const { body } = await resolvesInAtLeast(got('http://example.test'), 200)

    expect(body).to.equal(textFileContents)
    scope.done()
  })

  it('should work with a generic stream from the reply callback', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(200)
      .reply(200, () => fs.createReadStream(textFilePath))

    const { body } = await resolvesInAtLeast(got('http://example.test'), 200)

    expect(body).to.equal(textFileContents)
    scope.done()
  })

  it('should work with a generic stream from the reply callback', async () => {
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(200)
      .reply(200, () => fs.createReadStream(textFilePath))

    const { body, statusCode } = await resolvesInAtLeast(
      got('http://example.test'),
      200
    )

    expect(statusCode).to.equal(200)
    expect(body).to.equal(textFileContents)
    scope.done()
  })

  it('should delay errors when `replyWithError()` is used', async () => {
    nock('http://example.test')
      .get('/')
      .delayConnection(100)
      .replyWithError('this is an error message')

    await resolvesInAtLeast(
      assertRejects(got('http://example.test'), /this is an error message/),
      100
    )
  })

  it('emits a timeout - with setTimeout', done => {
    nock('http://example.test').get('/').delayConnection(10000).reply(200, 'OK')

    const onEnd = sinon.spy()

    const req = http.request('http://example.test', res => {
      res.once('end', onEnd)
    })

    req.setTimeout(5000, () => {
      expect(onEnd).not.to.have.been.called()
      done()
    })

    req.end()
  })

  it('emits a timeout - with options.timeout', done => {
    nock('http://example.test').get('/').delayConnection(10000).reply(200, 'OK')

    const onEnd = sinon.spy()

    const req = http.request('http://example.test', { timeout: 5000 }, res => {
      res.once('end', onEnd)
    })

    req.on('timeout', function () {
      expect(onEnd).not.to.have.been.called()
      done()
    })

    req.end()
  })

  it('emits a timeout - with Agent.timeout', done => {
    nock('http://example.test').get('/').delayConnection(10000).reply(200, 'OK')

    const onEnd = sinon.spy()
    const agent = new http.Agent({ timeout: 5000 })

    const req = http.request('http://example.test', { agent }, res => {
      res.once('end', onEnd)
    })

    req.on('timeout', function () {
      expect(onEnd).not.to.have.been.called()
      done()
    })

    req.end()
  })

  it('emits a timeout - options.timeout takes precedence over Agent.timeout', done => {
    nock('http://example.test').get('/').delayConnection(10000).reply(200, 'OK')

    const onEnd = sinon.spy()
    const agent = new http.Agent({ timeout: 30000 })

    const req = http.request(
      'http://example.test',
      { agent, timeout: 5000 },
      res => {
        res.once('end', onEnd)
      }
    )

    req.on('timeout', function () {
      expect(onEnd).not.to.have.been.called()
      done()
    })

    req.end()
  })

  it('does not emit a timeout when timeout > delayConnection', done => {
    const responseText = 'okeydoke!'
    const scope = nock('http://example.test')
      .get('/')
      .delayConnection(300)
      .reply(200, responseText)

    const req = http.request('http://example.test', res => {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', chunk => {
        body += chunk
      })

      res.once('end', () => {
        expect(body).to.equal(responseText)
        scope.done()
        done()
      })
    })

    req.setTimeout(60000, () => {
      expect.fail('socket timed out unexpectedly')
    })

    req.end()
  })
})
