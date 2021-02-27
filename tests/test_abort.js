'use strict'

const { expect } = require('chai')
const http = require('http')
const sinon = require('sinon')
const nock = require('..')

// These tests use `setTimeout` before verifying emitted events to ensure any
// number of `nextTicks` or `setImmediate` can process first.

// Node will emit a `prefinish` event after `socket`, but it's an internal,
// undocumented event that Nock does not emulate.

// The order of tests run sequentially through a ClientRequest's lifetime.
// Starting the top by aborting requests early on then aborting later and later.
describe('`ClientRequest.abort()`', () => {
  it('Emits the expected event sequence when `write` is called on an aborted request', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')
    req.abort()
    req.write('foo')

    setTimeout(() => {
      expect(emitSpy).to.have.been.calledOnceWithExactly('abort')
      expect(scope.isDone()).to.be.false()
      done()
    }, 10)
  })

  it('Emits the expected event sequence when `end` is called on an aborted request', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')
    req.abort()
    req.end()

    setTimeout(() => {
      expect(emitSpy).to.have.been.calledOnceWithExactly('abort')
      expect(scope.isDone()).to.be.false()
      done()
    }, 10)
  })

  it('Emits the expected event sequence when `flushHeaders` is called on an aborted request', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')
    req.abort()
    req.flushHeaders()

    setTimeout(() => {
      expect(emitSpy).to.have.been.calledOnceWithExactly('abort')
      expect(scope.isDone()).to.be.false()
      done()
    }, 10)
  })

  it('Emits the expected event sequence when aborted immediately after `end`', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')
    req.end()
    req.abort()

    setTimeout(() => {
      expect(emitSpy).to.have.been.calledOnceWithExactly('abort')
      expect(scope.isDone()).to.be.false()
      done()
    }, 10)
  })

  it('Emits the expected event sequence when aborted inside a `socket` event listener', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')

    req.on('socket', () => {
      req.abort()
    })
    req.on('error', err => {
      expect(err.message).to.equal('socket hang up')
      expect(err.code).to.equal('ECONNRESET')
    })
    req.end()

    setTimeout(() => {
      const events = emitSpy.args.map(i => i[0])
      expect(events).to.deep.equal(['socket', 'abort', 'error', 'close'])
      expect(scope.isDone()).to.be.false()
      done()
    }, 10)
  })

  it('Emits the expected event sequence when aborted multiple times', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')

    req.on('error', () => {}) // listen for error so it doesn't bubble
    req.on('socket', () => {
      req.abort()
      req.abort()
      req.abort()
    })
    req.end()

    setTimeout(() => {
      const events = emitSpy.args.map(i => i[0])
      // important: `abort` and `error` events only fire once and the `close` event still fires at the end
      expect(events).to.deep.equal(['socket', 'abort', 'error', 'close'])
      expect(scope.isDone()).to.be.false()
      done()
    }, 10)
  })

  // The Interceptor is considered consumed just prior to the `finish` event on the request,
  // all tests below assert the Scope is done.

  it('Emits the expected event sequence when aborted inside a `finish` event listener', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')

    req.on('finish', () => {
      req.abort()
    })
    req.on('error', err => {
      expect(err.message).to.equal('socket hang up')
      expect(err.code).to.equal('ECONNRESET')
    })
    req.end()

    setTimeout(() => {
      const events = emitSpy.args.map(i => i[0])
      expect(events).to.deep.equal([
        'socket',
        'finish',
        'abort',
        'error',
        'close',
      ])
      scope.done()
      done()
    }, 10)
  })

  it('Emits the expected event sequence when aborted after a delay from the `finish` event', done => {
    // use the delay functionality to create a window where the abort is called during the artificial connection wait.
    const scope = nock('http://example.test').get('/').delay(100).reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')

    req.on('finish', () => {
      setTimeout(() => {
        req.abort()
      }, 10)
    })
    req.on('error', err => {
      expect(err.message).to.equal('socket hang up')
      expect(err.code).to.equal('ECONNRESET')
    })
    req.end()

    setTimeout(() => {
      const events = emitSpy.args.map(i => i[0])
      expect(events).to.deep.equal([
        'socket',
        'finish',
        'abort',
        'error',
        'close',
      ])
      scope.done()
      done()
    }, 200)
  })

  it('Emits the expected event sequence when aborted inside a `response` event listener', done => {
    const scope = nock('http://example.test').get('/').reply()

    const req = http.request('http://example.test')
    const emitSpy = sinon.spy(req, 'emit')

    req.on('response', () => {
      req.abort()
    })
    req.end()

    setTimeout(() => {
      const events = emitSpy.args.map(i => i[0])
      expect(events).to.deep.equal([
        'socket',
        'finish',
        'response',
        'abort',
        'close',
      ])
      scope.done()
      done()
    }, 10)
  })
})
