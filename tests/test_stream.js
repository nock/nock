'use strict'

const events = require('events')
const http = require('http')
const path = require('path')
const stream = require('stream')
const util = require('util')
const { test } = require('tap')
const nock = require('../.')

const textFile = path.join(__dirname, '..', 'assets', 'reply_file_1.txt')

// TODO convert to async / got.
test('reply with file and pipe response', t => {
  nock('http://example.test')
    .get('/')
    .replyWithFile(200, textFile)

  http.get(
    {
      host: 'example.test',
      path: '/',
      port: 80,
    },
    res => {
      let str = ''
      const fakeStream = new (require('stream')).Stream()
      fakeStream.writable = true

      fakeStream.write = d => {
        str += d
      }

      fakeStream.end = () => {
        t.equal(str, 'Hello from the file!', 'response should match')
        t.end()
      }

      res.pipe(fakeStream)
      res.setEncoding('utf8')
      t.equal(res.statusCode, 200)
    }
  )
})

// TODO Convert to async / got.
test('pause response after data', t => {
  const response = new stream.PassThrough()
  const scope = nock('http://example.test')
    .get('/')
    // Node does not pause the 'end' event so we need to use a stream to simulate
    // multiple 'data' events.
    .reply(200, response)

  http.get(
    {
      host: 'example.test',
      path: '/',
    },
    res => {
      let waited = false
      setTimeout(() => {
        waited = true
        res.resume()
      }, 500)

      res.on('data', data => res.pause())

      res.on('end', () => {
        t.true(waited)
        scope.done()
        t.end()
      })
    }
  )

  // Manually simulate multiple 'data' events.
  response.emit('data', 'one')
  setTimeout(() => {
    response.emit('data', 'two')
    response.end()
  }, 0)
})

// TODO Convert to async / got.
test('response pipe', t => {
  const dest = (() => {
    function Constructor() {
      events.EventEmitter.call(this)

      this.buffer = Buffer.alloc(0)
      this.writable = true
    }

    util.inherits(Constructor, events.EventEmitter)

    Constructor.prototype.end = function() {
      this.emit('end')
    }

    Constructor.prototype.write = function(chunk) {
      const buf = Buffer.alloc(this.buffer.length + chunk.length)

      this.buffer.copy(buf)
      chunk.copy(buf, this.buffer.length)

      this.buffer = buf

      return true
    }

    return new Constructor()
  })()

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'nobody')

  http.get(
    {
      host: 'example.test',
      path: '/',
    },
    res => {
      dest.on('pipe', () => t.pass('should emit "pipe" event'))

      dest.on('end', () => {
        scope.done()
        t.equal(dest.buffer.toString(), 'nobody')
        t.end()
      })

      res.pipe(dest)
    }
  )
})

// TODO Convert to async / got.
test('response pipe without implicit end', t => {
  const dest = (() => {
    function Constructor() {
      events.EventEmitter.call(this)

      this.buffer = Buffer.alloc(0)
      this.writable = true
    }

    util.inherits(Constructor, events.EventEmitter)

    Constructor.prototype.end = function() {
      this.emit('end')
    }

    Constructor.prototype.write = function(chunk) {
      const buf = Buffer.alloc(this.buffer.length + chunk.length)

      this.buffer.copy(buf)
      chunk.copy(buf, this.buffer.length)

      this.buffer = buf

      return true
    }

    return new Constructor()
  })()

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'nobody')

  http.get(
    {
      host: 'example.test',
      path: '/',
    },
    res => {
      dest.on('end', () => t.fail('should not call end implicitly'))

      res.on('end', () => {
        scope.done()
        t.pass('should emit end event')
        t.end()
      })

      res.pipe(
        dest,
        { end: false }
      )
    }
  )
})

test('response is streams2 compatible', t => {
  const responseText = 'streams2 streams2 streams2'
  nock('http://example.test')
    .get('/somepath')
    .reply(200, responseText)

  http
    .request(
      {
        host: 'example.test',
        path: '/somepath',
      },
      function(res) {
        res.setEncoding('utf8')

        let body = ''

        res.on('readable', function() {
          let buf
          while ((buf = res.read())) body += buf
        })

        res.once('end', function() {
          t.equal(body, responseText)
          t.end()
        })
      }
    )
    .end()
})

test(
  'when a stream is used for the response body, it will not be read until after the response event',
  { skip: !stream.Readable },
  t => {
    let responseEvent = false
    const text = 'Hello World\n'

    function SimpleStream(opt) {
      stream.Readable.call(this, opt)
    }
    util.inherits(SimpleStream, stream.Readable)
    SimpleStream.prototype._read = function() {
      t.ok(responseEvent)
      this.push(text)
      this.push(null)
    }

    nock('http://localhost')
      .get('/')
      .reply(200, function(path, reqBody) {
        return new SimpleStream()
      })

    http.get('http://localhost/', function(res) {
      responseEvent = true
      res.setEncoding('utf8')

      let body = ''

      res.on('data', function(chunk) {
        body += chunk
      })

      res.once('end', function() {
        t.equal(body, text)
        t.end()
      })
    })
  }
)

test('response readable pull stream works as expected', t => {
  nock('http://example.test')
    .get('/ssstream')
    .reply(200, 'this is the response body yeah')

  const req = http.request(
    {
      host: 'example.test',
      path: '/ssstream',
      port: 80,
    },
    function(res) {
      let ended = false
      let responseBody = ''
      t.equal(res.statusCode, 200)
      res.on('readable', function() {
        let chunk
        while ((chunk = res.read()) !== null) {
          responseBody += chunk.toString()
        }
        if (chunk === null && !ended) {
          ended = true
          t.equal(responseBody, 'this is the response body yeah')
          t.end()
        }
      })
    }
  )

  req.end()
})
