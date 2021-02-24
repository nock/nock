'use strict'

const events = require('events')
const http = require('http')
const path = require('path')
const stream = require('stream')
const util = require('util')
const { expect } = require('chai')
const sinon = require('sinon')
const nock = require('..')
const got = require('./got_client')

const textFilePath = path.resolve(__dirname, './assets/reply_file_1.txt')

it('reply with file and pipe response', done => {
  const scope = nock('http://example.test')
    .get('/')
    .replyWithFile(200, textFilePath)

  let text = ''
  const fakeStream = new stream.Stream()
  fakeStream.writable = true
  fakeStream.write = d => {
    text += d
  }
  fakeStream.end = () => {
    expect(text).to.equal('Hello from the file!')
    scope.done()
    done()
  }

  got.stream('http://example.test/').pipe(fakeStream)
})

// TODO Convert to async / got.
it('pause response after data', done => {
  const response = new stream.PassThrough()
  const scope = nock('http://example.test')
    .get('/')
    // Node does not pause the 'end' event so we need to use a stream to simulate
    // multiple 'data' events.
    .reply(200, response)

  http.get('http://example.test', res => {
    const didTimeout = sinon.spy()

    setTimeout(() => {
      didTimeout()
      res.resume()
    }, 500)

    res.on('data', () => res.pause())

    res.on('end', () => {
      expect(didTimeout).to.have.been.calledOnce()
      scope.done()
      done()
    })

    // Manually simulate multiple 'data' events.
    response.emit('data', 'one')
    setTimeout(() => {
      response.emit('data', 'two')
      response.end()
    }, 0)
  })
})

// https://github.com/nock/nock/issues/1493
it("response has 'complete' property and it's true after end", done => {
  const response = new stream.PassThrough()
  const scope = nock('http://example.test')
    .get('/')
    // Node does not pause the 'end' event so we need to use a stream to simulate
    // multiple 'data' events.
    .reply(200, response)

  http.get('http://example.test', res => {
    const onData = sinon.spy()

    res.on('data', onData)

    res.on('end', () => {
      expect(onData).to.have.been.called()
      expect(res.complete).to.be.true()
      scope.done()
      done()
    })

    // Manually simulate multiple 'data' events.
    response.emit('data', 'one')
    response.end()
  })
})

// TODO Convert to async / got.
it('response pipe', done => {
  const dest = (() => {
    function Constructor() {
      events.EventEmitter.call(this)

      this.buffer = Buffer.alloc(0)
      this.writable = true
    }

    util.inherits(Constructor, events.EventEmitter)

    Constructor.prototype.end = function () {
      this.emit('end')
    }

    Constructor.prototype.write = function (chunk) {
      const buf = Buffer.alloc(this.buffer.length + chunk.length)

      this.buffer.copy(buf)
      chunk.copy(buf, this.buffer.length)

      this.buffer = buf

      return true
    }

    return new Constructor()
  })()

  const scope = nock('http://example.test').get('/').reply(200, 'nobody')

  http.get(
    {
      host: 'example.test',
      path: '/',
    },
    res => {
      const onPipeEvent = sinon.spy()

      dest.on('pipe', onPipeEvent)

      dest.on('end', () => {
        scope.done()
        expect(onPipeEvent).to.have.been.calledOnce()
        expect(dest.buffer.toString()).to.equal('nobody')
        done()
      })

      res.pipe(dest)
    }
  )
})

// TODO Convert to async / got.
it('response pipe without implicit end', done => {
  const dest = (() => {
    function Constructor() {
      events.EventEmitter.call(this)

      this.buffer = Buffer.alloc(0)
      this.writable = true
    }

    util.inherits(Constructor, events.EventEmitter)

    Constructor.prototype.end = function () {
      this.emit('end')
    }

    Constructor.prototype.write = function (chunk) {
      const buf = Buffer.alloc(this.buffer.length + chunk.length)

      this.buffer.copy(buf)
      chunk.copy(buf, this.buffer.length)

      this.buffer = buf

      return true
    }

    return new Constructor()
  })()

  const scope = nock('http://example.test').get('/').reply(200, 'nobody')

  http.get(
    {
      host: 'example.test',
      path: '/',
    },
    res => {
      dest.on('end', () => expect.fail('should not call end implicitly'))

      res.on('end', () => {
        scope.done()
        done()
      })

      res.pipe(dest, { end: false })
    }
  )
})

it('response is streams2 compatible', done => {
  const responseText = 'streams2 streams2 streams2'
  nock('http://example.test').get('/somepath').reply(200, responseText)

  http
    .request(
      {
        host: 'example.test',
        path: '/somepath',
      },
      function (res) {
        res.setEncoding('utf8')

        let body = ''

        res.on('readable', function () {
          let buf
          while ((buf = res.read())) body += buf
        })

        res.once('end', function () {
          expect(body).to.equal(responseText)
          done()
        })
      }
    )
    .end()
})

it('when a stream is used for the response body, it will not be read until after the response event', done => {
  let responseEvent = false
  const responseText = 'Hello World\n'

  class SimpleStream extends stream.Readable {
    _read() {
      expect(responseEvent).to.be.true()
      this.push(responseText)
      this.push(null)
    }
  }

  nock('http://localhost')
    .get('/')
    .reply(201, () => new SimpleStream())

  http.get('http://localhost/', res => {
    responseEvent = true
    res.setEncoding('utf8')

    let body = ''
    expect(res.statusCode).to.equal(201)

    res.on('data', function (chunk) {
      body += chunk
    })

    res.once('end', function () {
      expect(body).to.equal(responseText)
      done()
    })
  })
})

// https://github.com/nock/nock/issues/193
it('response readable pull stream works as expected', done => {
  nock('http://example.test')
    .get('/ssstream')
    .reply(200, 'this is the response body yeah')

  const req = http.request(
    {
      host: 'example.test',
      path: '/ssstream',
      port: 80,
    },
    res => {
      let ended = false
      let responseBody = ''
      expect(res.statusCode).to.equal(200)
      res.on('readable', function () {
        let chunk
        while ((chunk = res.read()) !== null) {
          responseBody += chunk.toString()
        }
        if (chunk === null && !ended) {
          ended = true
          expect(responseBody).to.equal('this is the response body yeah')
          done()
        }
      })
    }
  )

  req.end()
})

it('error events on reply streams proxy to the response', done => {
  // This test could probably be written to use got, however, that lib has a lot
  // of built in error handling and this test would get convoluted.

  const replyBody = new stream.PassThrough()
  const scope = nock('http://example.test').get('/').reply(201, replyBody)

  http.get(
    {
      host: 'example.test',
      method: 'GET',
      path: '/',
    },
    res => {
      res.on('error', err => {
        expect(err).to.equal('oh no!')
        scope.done()
        done()
      })

      replyBody.end(() => {
        replyBody.emit('error', 'oh no!')
      })
    }
  )
})
