'use strict'

// Tests for header objects passed to `.reply()`, including header objects
// containing lambdas.

const { IncomingMessage } = require('http')
const { expect } = require('chai')
const sinon = require('sinon')
const fakeTimers = require('@sinonjs/fake-timers')
const fs = require('fs')
const path = require('path')

const nock = require('..')
const got = require('./got_client')

const textFilePath = path.resolve(__dirname, './assets/reply_file_1.txt')

describe('`reply()` headers', () => {
  describe('using parameter value', () => {
    it('as array', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(200, 'Hello World!', [
          'X-My-Header',
          'My Header value',
          'X-Other-Header',
          'My Other Value',
        ])

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({
        'x-my-header': 'My Header value',
        'x-other-header': 'My Other Value',
      })
      expect(rawHeaders).to.deep.equal([
        'X-My-Header',
        'My Header value',
        'X-Other-Header',
        'My Other Value',
      ])
      scope.done()
    })

    it('given an invalid array, raises the expected error', async () => {
      const scope = nock('http://example.test').get('/')

      expect(() =>
        scope.reply(200, 'Hello World!', ['one', 'two', 'three'])
      ).to.throw(
        Error,
        'Raw headers must be provided as an array with an even number of items. [fieldName, value, ...]'
      )
    })

    // https://nodejs.org/api/http.html#http_message_headers
    it('folds duplicate headers the same as Node', async () => {
      const replyHeaders = [
        'Content-Type',
        'text/html; charset=utf-8',
        'set-cookie',
        ['set-cookie1=foo', 'set-cookie2=bar'],
        'set-cookie',
        'set-cookie3=baz',
        'CONTENT-TYPE',
        'text/xml',
        'cookie',
        'cookie1=foo; cookie2=bar',
        'cookie',
        'cookie3=baz',
        'x-custom',
        'custom1',
        'X-Custom',
        ['custom2', 'custom3'],
      ]
      const scope = nock('http://example.test')
        .get('/')
        .reply(200, 'Hello World!', replyHeaders)

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': ['set-cookie1=foo', 'set-cookie2=bar', 'set-cookie3=baz'],
        cookie: 'cookie1=foo; cookie2=bar; cookie3=baz',
        'x-custom': 'custom1, custom2, custom3',
      })
      expect(rawHeaders).to.deep.equal(replyHeaders)

      scope.done()
    })

    it('as object', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(200, 'Hello World!', { 'X-My-Headers': 'My Header value' })

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({ 'x-my-headers': 'My Header value' })
      expect(rawHeaders).to.deep.equal(['X-My-Headers', 'My Header value'])
      scope.done()
    })

    it('as Map', async () => {
      const replyHeaders = new Map([
        ['X-My-Header', 'My Header value'],
        ['X-Other-Header', 'My Other Value'],
      ])
      const scope = nock('http://example.test')
        .get('/')
        .reply(200, 'Hello World!', replyHeaders)

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({
        'x-my-header': 'My Header value',
        'x-other-header': 'My Other Value',
      })
      expect(rawHeaders).to.deep.equal([
        'X-My-Header',
        'My Header value',
        'X-Other-Header',
        'My Other Value',
      ])
      scope.done()
    })

    it('given invalid data types, raises the expected error', async () => {
      const scope = nock('http://example.test').get('/')

      expect(() => scope.reply(200, 'Hello World!', 'foo: bar')).to.throw(
        Error,
        'Headers must be provided as an array of raw values, a Map, or a plain Object. foo: bar'
      )

      expect(() => scope.reply(200, 'Hello World!', false)).to.throw(
        Error,
        'Headers must be provided as an array of raw values, a Map, or a plain Object. false'
      )
    })
  })

  describe('using synchronous reply function', () => {
    it('as array', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [
          200,
          'Hello World!',
          [
            'X-My-Header',
            'My Header value',
            'X-Other-Header',
            'My Other Value',
          ],
        ])

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({
        'x-my-header': 'My Header value',
        'x-other-header': 'My Other Value',
      })
      expect(rawHeaders).to.deep.equal([
        'X-My-Header',
        'My Header value',
        'X-Other-Header',
        'My Other Value',
      ])
      scope.done()
    })

    it('as object', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [
          200,
          'Hello World!',
          { 'X-My-Headers': 'My Header value' },
        ])

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({ 'x-my-headers': 'My Header value' })
      expect(rawHeaders).to.deep.equal(['X-My-Headers', 'My Header value'])
      scope.done()
    })

    it('as Map', async () => {
      const replyHeaders = new Map([
        ['X-My-Header', 'My Header value'],
        ['X-Other-Header', 'My Other Value'],
      ])
      const scope = nock('http://example.test')
        .get('/')
        .reply(() => [200, 'Hello World!', replyHeaders])

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({
        'x-my-header': 'My Header value',
        'x-other-header': 'My Other Value',
      })
      expect(rawHeaders).to.deep.equal([
        'X-My-Header',
        'My Header value',
        'X-Other-Header',
        'My Other Value',
      ])
      scope.done()
    })
  })

  describe('using functions', () => {
    it('sends the result back in the response', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .reply(200, 'boo!', {
          'X-My-Headers': () => 'yo!',
        })

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({ 'x-my-headers': 'yo!' })
      expect(rawHeaders).to.deep.equal(['X-My-Headers', 'yo!'])
      scope.done()
    })

    it('receives the correct arguments', async () => {
      const myHeaderFnCalled = sinon.spy()

      const { ClientRequest: OverriddenClientRequest } = require('http')
      const scope = nock('http://example.test')
        .post('/')
        .reply(200, 'boo!', {
          'X-My-Headers': (req, res, body) => {
            myHeaderFnCalled()
            expect(req).to.be.an.instanceof(OverriddenClientRequest)
            expect(res).to.be.an.instanceof(IncomingMessage)
            expect(body).to.equal('boo!')
            return 'gotcha'
          },
        })

      await got.post('http://example.test/')

      expect(myHeaderFnCalled).to.have.been.called()
      scope.done()
    })

    it('is evaluated exactly once', async () => {
      const myHeaderFnCalled = sinon.spy()

      const scope = nock('http://example.test')
        .get('/')
        .reply(200, 'boo!', {
          'X-My-Headers': () => {
            myHeaderFnCalled()
            return 'heya'
          },
        })

      await got('http://example.test/')

      expect(myHeaderFnCalled).to.have.been.calledOnce()
      scope.done()
    })

    it('when keys are duplicated, is evaluated once per input field name, in correct order', async () => {
      const replyHeaders = [
        'X-MY-HEADER',
        () => 'one',
        'x-my-header',
        () => 'two',
      ]

      const scope = nock('http://example.test')
        .get('/')
        .reply(200, 'Hello World!', replyHeaders)

      const { headers, rawHeaders } = await got('http://example.test/')

      expect(headers).to.deep.equal({ 'x-my-header': 'one, two' })
      expect(rawHeaders).to.deep.equal([
        'X-MY-HEADER',
        'one',
        'x-my-header',
        'two',
      ])

      scope.done()
    })

    it('is re-evaluated for a subsequent request', async () => {
      let counter = 0
      const scope = nock('http://example.test')
        .get('/')
        .times(2)
        .reply(200, 'boo!', {
          'X-My-Headers': () => `${++counter}`,
        })

      const { headers, rawHeaders } = await got('http://example.test/')
      expect(headers).to.deep.equal({ 'x-my-headers': '1' })
      expect(rawHeaders).to.deep.equal(['X-My-Headers', '1'])

      expect(counter).to.equal(1)

      const { headers: headers2, rawHeaders: rawHeaders2 } = await got(
        'http://example.test/'
      )
      expect(headers2).to.deep.equal({ 'x-my-headers': '2' })
      expect(rawHeaders2).to.deep.equal(['X-My-Headers', '2'])

      expect(counter).to.equal(2)

      scope.done()
    })
  })
})

describe('`replyContentLength()`', () => {
  it('sends explicit content-length header with response', async () => {
    const response = { hello: 'world' }

    const scope = nock('http://example.test')
      .replyContentLength()
      .get('/')
      .reply(200, response)

    const { headers } = await got('http://example.test/')

    expect(headers['content-length']).to.equal(
      `${JSON.stringify(response).length}`
    )
    scope.done()
  })

  it('sends explicit content-length header with string response', async () => {
    const response = '<html><body>...</body></html>'

    const scope = nock('http://example.test')
      .replyContentLength()
      .get('/')
      .reply(200, response)

    const { headers } = await got('http://example.test/')

    expect(headers['content-length']).to.equal(`${response.length}`)
    scope.done()
  })

  it('sends explicit content-length header with buffer response', async () => {
    const response = Buffer.from([1, 2, 3, 4, 5, 6])

    const scope = nock('http://example.test')
      .replyContentLength()
      .get('/')
      .reply(200, response)

    const { headers } = await got('http://example.test/')

    expect(headers['content-length']).to.equal(`${response.byteLength}`)
    scope.done()
  })

  it('should not send content-length when responding with a stream', async () => {
    const scope = nock('http://example.test')
      .replyContentLength()
      .get('/')
      .reply(200, () => fs.createReadStream(textFilePath))

    const { headers } = await got('http://example.test/')

    expect(headers['content-length']).to.be.undefined()
    scope.done()
  })
})

describe('`replyDate()`', () => {
  it('sends explicit date header with response', async () => {
    const date = new Date()

    const scope = nock('http://example.test').replyDate(date).get('/').reply()

    const { headers } = await got('http://example.test/')

    expect(headers.date).to.equal(date.toUTCString())
    scope.done()
  })

  describe('with mock timers', () => {
    let clock
    beforeEach(() => {
      clock = fakeTimers.install()
    })
    afterEach(() => {
      if (clock) {
        clock.uninstall()
        clock = undefined
      }
    })

    it('sends date header with response', async () => {
      const scope = nock('http://example.test').replyDate().get('/').reply()

      const req = got('http://example.test/')
      clock.tick()
      const { headers } = await req
      const date = new Date()
      expect(headers).to.include({ date: date.toUTCString() })

      scope.done()
    })
  })
})
