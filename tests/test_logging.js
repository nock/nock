'use strict'

const debug = require('debug')
const got = require('got')
const sinon = require('sinon')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_after_each')()

test('match debugging works', async t => {
  const log = sinon.stub(debug, 'log')
  debug.enable('nock.interceptor')
  t.once('end', () => {
    sinon.restore()
    debug.disable('nock.interceptor')
  })

  nock('http://example.test')
    .post('/deep/link')
    .reply(200, 'Hello World!')

  const exampleBody = 'Hello yourself!'
  await got.post('http://example.test/deep/link', { body: exampleBody })

  t.ok(log.calledOnce)
  t.equal(
    JSON.parse(log.getCall(0).args[1]).href,
    'http://example.test/deep/link'
  )
  t.equal(JSON.parse(log.getCall(0).args[2]), exampleBody)
})

test('should log matching', async t => {
  const messages = []

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello, World!')
    .log(message => messages.push(message))

  await got('http://example.test/')

  t.deepEqual(messages, [
    'matching http://example.test:80/ to GET http://example.test:80/: true',
  ])

  scope.done()
})
