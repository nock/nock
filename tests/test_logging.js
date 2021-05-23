'use strict'

const debug = require('debug')
const sinon = require('sinon')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

describe('Logging using the `debug` package', () => {
  let logFn
  beforeEach(() => {
    logFn = sinon.stub(debug, 'log')
    debug.enable('nock*')
  })

  afterEach(() => {
    debug.disable('nock*')
  })

  it('match debugging works', async () => {
    nock('http://example.test').post('/deep/link').reply(200, 'Hello World!')

    const exampleBody = 'Hello yourself!'
    await got.post('http://example.test/deep/link', { body: exampleBody })

    // the log function will have been a few dozen times, there are a few specific to matching we want to validate:

    // the log when an interceptor is chosen
    expect(logFn).to.have.been.calledWith(
      sinon.match('matched base path (1 interceptor)')
    )

    // the log of the Interceptor match
    expect(logFn).to.have.been.calledWith(
      // debug namespace for the scope that includes the host
      sinon.match('nock.scope:example.test'),
      // This is a JSON blob which contains, among other things the complete
      // request URL.
      sinon.match('"href":"http://example.test/deep/link"'),
      // This is the JSON-stringified body.
      `"${exampleBody}"`
    )

    expect(logFn).to.have.been.calledWith(sinon.match('query matching skipped'))

    expect(logFn).to.have.been.calledWith(
      sinon.match(
        'matching http://example.test:80/deep/link to POST http://example.test:80/deep/link: true'
      )
    )
    expect(logFn).to.have.been.calledWith(
      sinon.match('interceptor identified, starting mocking')
    )
  })
})
