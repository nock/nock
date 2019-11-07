'use strict'

const debug = require('debug')
const sinon = require('sinon')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

require('./setup')

describe('Logging using the `debug` package', () => {
  let logFn
  beforeEach(() => {
    logFn = sinon.stub(debug, 'log')
    debug.enable('nock.interceptor')
  })
  afterEach(() => {
    sinon.restore()
    debug.disable('nock.interceptor')
  })

  it('match debugging works', async () => {
    nock('http://example.test')
      .post('/deep/link')
      .reply(200, 'Hello World!')

    const exampleBody = 'Hello yourself!'
    await got.post('http://example.test/deep/link', { body: exampleBody })

    expect(logFn).to.have.been.calledWithExactly(
      sinon.match.string,
      // This is a JSON blob which contains, among other things the complete
      // request URL.
      sinon.match('"href":"http://example.test/deep/link"'),
      // This is the JSON-stringified body.
      `"${exampleBody}"`,
      sinon.match.string
    )
  })
})

describe('`log()`', () => {
  it('should log host matching', async () => {
    const logFn = sinon.spy()

    const scope = nock('http://example.test')
      .get('/')
      .reply(200, 'Hello, World!')
      .log(logFn)

    await got('http://example.test/')

    expect(logFn).to.have.been.calledOnceWithExactly(
      'matching http://example.test:80/ to GET http://example.test:80/: true'
    )

    scope.done()
  })
})
