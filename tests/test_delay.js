'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const stream = require('stream')
const assertRejects = require('assert-rejects')
const got = require('got')
const mikealRequest = require('request')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_after_each')()

const textFile = path.join(__dirname, '..', 'assets', 'reply_file_1.txt')

function checkDuration(t, ms) {
  // Do not write new tests using this function. Write async tests using
  // `resolvesInAtLeast` instead.
  const _end = t.end
  const start = process.hrtime()
  let ended = false
  t.end = function() {
    if (ended) return
    ended = true
    const fin = process.hrtime(start)
    const finMs =
      fin[0] * 1000 + // seconds -> ms
      fin[1] * 1e-6 // nanoseconds -> ms

    /// innaccurate timers
    ms = ms * 0.9

    t.ok(
      finMs >= ms,
      `Duration of ${Math.round(finMs)}ms should be longer than ${ms}ms`
    )
    _end.call(t)
  }
}

async function resolvesInAtLeast(t, fn, durationMillis) {
  const startTime = process.hrtime()

  await fn()

  const [seconds, nanoseconds] = process.hrtime(startTime)
  const elapsedTimeMillis = seconds * 1000 + nanoseconds * 1e-6

  t.ok(
    elapsedTimeMillis >= durationMillis,
    `Duration of ${Math.round(
      elapsedTimeMillis
    )} ms should be at least ${durationMillis} ms`
  )
}

test('calling delay could cause mikealRequest timeout error', t => {
  const scope = nock('http://example.test')
    .get('/')
    .delay({
      head: 300,
    })
    .reply(200, 'OK')

  mikealRequest(
    {
      uri: 'http://example.test',
      method: 'GET',
      timeout: 100,
    },
    function(err) {
      scope.done()
      t.equal(err && err.code, 'ESOCKETTIMEDOUT')
      t.end()
    }
  )
})

test('Body delay does not have impact on timeout', t => {
  const scope = nock('http://example.test')
    .get('/')
    .delay({
      head: 300,
      body: 300,
    })
    .reply(200, 'OK')

  mikealRequest(
    {
      uri: 'http://example.test',
      method: 'GET',
      timeout: 500,
    },
    function(err, r, body) {
      t.equal(err, null)
      t.equal(body, 'OK')
      t.equal(r.statusCode, 200)
      scope.done()
      t.end()
    }
  )
})

test('calling delay with "body" and "head" delays the response', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 600)

  nock('http://example.test')
    .get('/')
    .delay({
      head: 300,
      body: 300,
    })
    .reply(200, 'OK')

  http.get('http://example.test', function(res) {
    res.once('data', function(data) {
      t.equal(data.toString(), 'OK')
      res.once('end', t.end.bind(t))
    })
  })
})

test('calling delay with "body" delays the response body', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .delay({ body: 100 })
    .reply(200, 'OK')

  await resolvesInAtLeast(
    t,
    async () => {
      const { body } = await got('http://example.test/')
      t.equal(body, 'OK')
    },
    100
  )

  scope.done()
})

test('calling delayBody delays the response', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .delayBody(100)
    .reply(200, 'OK')

  await resolvesInAtLeast(
    t,
    async () => {
      const { body } = await got('http://example.test')
      t.equal(body, 'OK')
    },
    100
  )

  scope.done()
})

test('delayBody works with a stream', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .delayBody(100)
    .reply(200, (uri, requestBody) =>
      fs.createReadStream(textFile, { encoding: 'utf8' })
    )

  await resolvesInAtLeast(
    t,
    async () => {
      const { body } = await got('http://example.test')
      t.equal(body, fs.readFileSync(textFile, { encoding: 'utf8' }))
    },
    100
  )

  scope.done()
})

test('delayBody works with a stream of binary buffers', async t => {
  const scope = nock('http://example.com')
    .get('/')
    .delayBody(100)
    // No encoding specified, which causes the file to be streamed using
    // buffers instead of strings.
    .reply(200, (uri, requestBody) => fs.createReadStream(textFile))

  await resolvesInAtLeast(
    t,
    async () => {
      const { body } = await got('http://example.com/')
      t.equal(body, fs.readFileSync(textFile, { encoding: 'utf8' }))
    },
    100
  )

  scope.done()
})

test('delayBody works with a delayed stream', async t => {
  const passthrough = new stream.Transform({
    transform(chunk, encoding, callback) {
      this.push(chunk.toString())
      callback()
    },
  })

  const scope = nock('http://example.com')
    .get('/')
    .delayBody(100)
    .reply(200, (uri, requestBody) => passthrough)

  setTimeout(() => fs.createReadStream(textFile).pipe(passthrough), 125)

  const { body } = await got('http://example.com/')
  t.equal(body, fs.readFileSync(textFile, { encoding: 'utf8' }))

  scope.done()
})

test('calling delay delays the response', async t => {
  const scope = nock('http://example.test')
    .get('/')
    .delay(100)
    .reply(200, 'OK')

  await resolvesInAtLeast(
    t,
    async () => {
      const { body } = await got('http://example.test/')
      t.equal(body, 'OK')
    },
    100
  )

  scope.done()
})

// TODO: This test is difficult to port to got. It's not clear why the request
// matches given that there's a request body that isn't specified by the mock.
test('using reply callback with delay provides proper arguments', t => {
  nock('http://localhost')
    .get('/')
    .delay(100)
    .reply(200, function(path, requestBody) {
      t.equal(path, '/', 'path arg should be set')
      t.equal(requestBody, 'OK', 'requestBody arg should be set')
      t.end()
    })

  http.request('http://localhost/', function() {}).end('OK')
})

test('using reply callback with delay can reply JSON', t => {
  nock('http://example.test')
    .get('/')
    .delay(100)
    .reply(200, function(path, requestBody) {
      return { a: 1 }
    })

  mikealRequest.get(
    {
      url: 'http://example.test/',
      json: true,
    },
    function(err, res, body) {
      t.equals(res.headers['content-type'], 'application/json')
      t.deepEqual(body, { a: 1 })
      t.end()
    }
  )
})

test('delay works with replyWithFile', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delay(100)
    .replyWithFile(200, `${__dirname}/../assets/reply_file_1.txt`)

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('delay works with when you return a generic stream from the reply callback', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delay(100)
    .reply(200, function(path, reqBody) {
      return fs.createReadStream(`${__dirname}/../assets/reply_file_1.txt`)
    })

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('delay with replyWithError: response is delayed', async t => {
  nock('http://example.test')
    .get('/')
    .delay(100)
    .replyWithError('this is an error message')

  await resolvesInAtLeast(
    t,
    async () =>
      assertRejects(
        got('http://example.test'),
        Error,
        'this is an error message'
      ),
    100
  )
})

test('calling delayConnection delays the connection', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://example.test')
    .get('/')
    .delayConnection(100)
    .reply(200, 'OK')

  http.get('http://example.test', function(res) {
    res.setEncoding('utf8')

    let body = ''

    res.on('data', function(chunk) {
      body += chunk
    })

    res.once('end', function() {
      t.equal(body, 'OK')
      t.end()
    })
  })
})

test('using reply callback with delayConnection provides proper arguments', t => {
  nock('http://localhost')
    .get('/')
    .delayConnection(100)
    .reply(200, function(path, requestBody) {
      t.equal(path, '/', 'path arg should be set')
      t.equal(requestBody, 'OK', 'requestBody arg should be set')
      t.end()
    })

  http.request('http://localhost/', function() {}).end('OK')
})

test('delayConnection works with replyWithFile', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delayConnection(100)
    .replyWithFile(200, `${__dirname}/../assets/reply_file_1.txt`)

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('delayConnection works with when you return a generic stream from the reply callback', t => {
  // Do not base new tests on this one. Write async tests using
  // `resolvesInAtLeast` instead.
  checkDuration(t, 100)

  nock('http://localhost')
    .get('/')
    .delayConnection(100)
    .reply(200, function(path, reqBody) {
      return fs.createReadStream(`${__dirname}/../assets/reply_file_1.txt`)
    })

  http
    .request('http://localhost/', function(res) {
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(
          body,
          'Hello from the file!',
          'the body should eql the text from the file'
        )
        t.end()
      })
    })
    .end('OK')
})

test('mikeal/request with delayConnection and request.timeout', t => {
  nock('http://example.test')
    .post('/')
    .delayConnection(1000)
    .reply(200, {})

  mikealRequest.post(
    {
      url: 'http://example.test',
      timeout: 10,
    },
    function(err) {
      t.type(err, 'Error')
      t.equal(err && err.code, 'ESOCKETTIMEDOUT')
      t.end()
    }
  )
})
