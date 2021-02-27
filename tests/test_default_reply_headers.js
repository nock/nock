'use strict'

const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

describe('`defaultReplyHeaders()`', () => {
  it('when no headers are specified on the request, default reply headers work', async () => {
    nock('http://example.test')
      .defaultReplyHeaders({
        'X-Powered-By': 'Meeee',
        'X-Another-Header': ['foo', 'bar'],
      })
      .get('/')
      .reply(200, '')

    const { headers, rawHeaders } = await got('http://example.test/')

    expect(headers).to.deep.equal({
      'x-powered-by': 'Meeee',
      'x-another-header': 'foo, bar',
    })

    expect(rawHeaders).to.deep.equal([
      'X-Powered-By',
      'Meeee',
      'X-Another-Header',
      ['foo', 'bar'],
    ])
  })

  it('default reply headers can be provided as a raw array', async () => {
    const defaultHeaders = [
      'X-Powered-By',
      'Meeee',
      'X-Another-Header',
      ['foo', 'bar'],
    ]
    nock('http://example.test')
      .defaultReplyHeaders(defaultHeaders)
      .get('/')
      .reply(200, '')

    const { headers, rawHeaders } = await got('http://example.test/')

    expect(headers).to.deep.equal({
      'x-powered-by': 'Meeee',
      'x-another-header': 'foo, bar',
    })

    expect(rawHeaders).to.deep.equal(defaultHeaders)
  })

  it('default reply headers can be provided as a Map', async () => {
    const defaultHeaders = new Map([
      ['X-Powered-By', 'Meeee'],
      ['X-Another-Header', ['foo', 'bar']],
    ])
    nock('http://example.test')
      .defaultReplyHeaders(defaultHeaders)
      .get('/')
      .reply(200, '')

    const { headers, rawHeaders } = await got('http://example.test/')

    expect(headers).to.deep.equal({
      'x-powered-by': 'Meeee',
      'x-another-header': 'foo, bar',
    })

    expect(rawHeaders).to.deep.equal([
      'X-Powered-By',
      'Meeee',
      'X-Another-Header',
      ['foo', 'bar'],
    ])
  })

  it('when headers are specified on the request, they override default reply headers', async () => {
    nock('http://example.test')
      .defaultReplyHeaders({
        'X-Powered-By': 'Meeee',
        'X-Another-Header': 'Hey man!',
      })
      .get('/')
      .reply(200, '', { A: 'b' })

    const { headers } = await got('http://example.test/')

    expect(headers).to.deep.equal({
      'x-powered-by': 'Meeee',
      'x-another-header': 'Hey man!',
      a: 'b',
    })
  })

  it('default reply headers as functions work', async () => {
    const date = new Date().toUTCString()
    const message = 'A message.'

    nock('http://example.test')
      .defaultReplyHeaders({
        'Content-Length': (req, res, body) => body.length,
        Date: () => date,
        Foo: () => 'foo',
      })
      .get('/')
      .reply(200, message, { foo: 'bar' })

    const { headers } = await got('http://example.test')

    expect(headers).to.deep.equal({
      'content-length': message.length.toString(),
      date,
      foo: 'bar',
    })
  })

  it('reply should not cause an error on header conflict', async () => {
    const scope = nock('http://example.test').defaultReplyHeaders({
      'content-type': 'application/json',
    })

    scope.get('/').reply(200, '<html></html>', {
      'Content-Type': 'application/xml',
    })

    const { statusCode, headers, body } = await got('http://example.test/')

    expect(statusCode).to.equal(200)
    expect(headers['content-type']).to.equal('application/xml')
    expect(body).to.equal('<html></html>')
  })

  it('direct reply headers override defaults when casing differs', async () => {
    const scope = nock('http://example.test')
      .defaultReplyHeaders({
        'X-Default-Only': 'default',
        'X-Overridden': 'default',
      })
      .get('/')
      .reply(200, 'Success!', {
        'X-Reply-Only': 'from-reply',
        'x-overridden': 'from-reply',
      })

    const { headers, rawHeaders } = await got('http://example.test/')

    expect(headers).to.deep.equal({
      'x-default-only': 'default',
      'x-reply-only': 'from-reply',
      'x-overridden': 'from-reply', // note this overrode the default value, despite the case difference
    })
    expect(rawHeaders).to.deep.equal([
      'X-Reply-Only',
      'from-reply',
      'x-overridden',
      'from-reply',
      'X-Default-Only',
      'default',
      // note 'X-Overridden' from the defaults is not included
    ])
    scope.done()
  })

  it('dynamic reply headers override defaults when casing differs', async () => {
    const scope = nock('http://example.test')
      .defaultReplyHeaders({
        'X-Default-Only': 'default',
        'X-Overridden': 'default',
      })
      .get('/')
      .reply(() => [
        200,
        'Success!',
        {
          'X-Reply-Only': 'from-reply',
          'x-overridden': 'from-reply',
        },
      ])

    const { headers, rawHeaders } = await got('http://example.test/')

    expect(headers).to.deep.equal({
      'x-default-only': 'default',
      'x-reply-only': 'from-reply',
      'x-overridden': 'from-reply',
    })
    expect(rawHeaders).to.deep.equal([
      'X-Reply-Only',
      'from-reply',
      'x-overridden',
      'from-reply',
      'X-Default-Only',
      'default',
    ])
    scope.done()
  })
})
