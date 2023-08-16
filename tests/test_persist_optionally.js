'use strict'

// `persist()` and `optionally()` are closely related. Their tests are both
// contained in this file.

const http = require('http')
const path = require('path')
const assertRejects = require('assert-rejects')
const { expect } = require('chai')
const nock = require('..')
const got = require('./got_client')

const textFilePath = path.resolve(__dirname, './assets/reply_file_1.txt')

describe('`optionally()`', () => {
  it('optional mocks do not appear in `pendingMocks()`', () => {
    nock('http://example.test').get('/nonexistent').optionally().reply(200)

    expect(nock.pendingMocks()).to.be.empty()
  })

  it('when called with `true`, makes the mock optional', () => {
    nock('http://example.test').get('/nonexistent').optionally(true).reply(200)

    expect(nock.pendingMocks()).to.be.empty()
  })

  it('when called with `false`, the mock is still required', () => {
    nock('http://example.test').get('/nonexistent').optionally(false).reply(200)

    expect(nock.pendingMocks()).to.have.lengthOf(1)
  })

  it('when called with non-boolean, throws the expected error', () => {
    const interceptor = nock('http://example.test').get('/')

    expect(() => interceptor.optionally('foo')).to.throw(
      Error,
      'Invalid arguments: argument should be a boolean'
    )
  })

  it('optional mocks can be matched', done => {
    nock('http://example.test').get('/abc').optionally().reply(200)

    http.get({ host: 'example.test', path: '/abc' }, res => {
      expect(res.statusCode).to.equal(200)
      expect(nock.pendingMocks()).to.be.empty()
      done()
    })
  })

  it('before matching, `isDone()` is true', () => {
    const scope = nock('http://example.test')
      .get('/abc')
      .optionally()
      .reply(200)

    expect(scope.isDone()).to.be.true()
  })

  describe('in conjunction with `persist()`', () => {
    it('when optional mocks are also persisted, they do not appear as pending', async () => {
      const scope = nock('http://example.test')
        .get('/')
        .optionally()
        .reply(200)
        .persist()

      expect(nock.pendingMocks()).to.be.empty()

      const response1 = await got('http://example.test/')
      expect(response1.statusCode).to.equal(200)

      expect(nock.pendingMocks()).to.be.empty()

      const response2 = await got('http://example.test/')
      expect(response2.statusCode).to.equal(200)
      expect(nock.pendingMocks()).to.be.empty()

      scope.done()
    })
  })

  it('optional repeated mocks execute repeatedly', done => {
    nock('http://example.test').get('/456').optionally().times(2).reply(200)

    http.get({ host: 'example.test', path: '/456' }, res => {
      expect(res.statusCode).to.equal(200)
      http.get({ host: 'example.test', path: '/456' }, res => {
        expect(res.statusCode).to.equal(200)
        done()
      })
    })
  })

  it("optional mocks appear in `activeMocks()` only until they're matched", done => {
    nock('http://example.test').get('/optional').optionally().reply(200)

    expect(nock.activeMocks()).to.deep.equal([
      'GET http://example.test:80/optional',
    ])
    http.get({ host: 'example.test', path: '/optional' }, res => {
      expect(nock.activeMocks()).to.be.empty()
      done()
    })
  })
})

describe('`persist()`', () => {
  it('`activeMocks()` always returns persisted mocks, even after matching', async () => {
    const scope = nock('http://example.test')
      .get('/persisted')
      .reply(200)
      .persist()

    expect(nock.activeMocks()).to.deep.equal([
      'GET http://example.test:80/persisted',
    ])

    await got('http://example.test/persisted')

    expect(nock.activeMocks()).to.deep.equal([
      'GET http://example.test:80/persisted',
    ])

    scope.done()
  })

  it('persisted mocks match repeatedly', async () => {
    const scope = nock('http://example.test')
      .persist()
      .get('/')
      .reply(200, 'Persisting all the way')

    expect(scope.isDone()).to.be.false()

    await got('http://example.test/')

    expect(scope.isDone()).to.be.true()

    await got('http://example.test/')

    expect(scope.isDone()).to.be.true()
  })

  it('persisted mocks appear in `pendingMocks()`', async () => {
    const scope = nock('http://example.test')
      .get('/abc')
      .reply(200, 'Persisted reply')
      .persist()

    expect(scope.pendingMocks()).to.deep.equal([
      'GET http://example.test:80/abc',
    ])
  })

  it('persisted mocks are removed from `pendingMocks()` once they are matched once', async () => {
    const scope = nock('http://example.test')
      .get('/def')
      .reply(200, 'Persisted reply')
      .persist()

    await got('http://example.test/def')

    expect(scope.pendingMocks()).to.deep.equal([])
  })

  it('persisted mocks can use `replyWithFile()`', async () => {
    nock('http://example.test')
      .persist()
      .get('/')
      .replyWithFile(200, textFilePath)
      .get('/test')
      .reply(200, 'Yay!')

    for (let i = 0; i < 2; ++i) {
      const { statusCode, body } = await got('http://example.test/')
      expect(statusCode).to.equal(200)
      expect(body).to.equal('Hello from the file!')
    }
  })

  it('can call `persist(false)` to stop persisting', async () => {
    const scope = nock('http://example.test')
      .persist(true)
      .get('/')
      .reply(200, 'Persisting all the way')

    expect(scope.isDone()).to.be.false()

    await got('http://example.test/')

    expect(scope.isDone()).to.be.true()
    expect(nock.activeMocks()).to.deep.equal(['GET http://example.test:80/'])

    scope.persist(false)

    await got('http://example.test/')

    expect(nock.activeMocks()).to.be.empty()
    expect(scope.isDone()).to.be.true()

    await assertRejects(
      got('http://example.test/'),
      /Nock: No match for request/
    )
  })

  it('when called with an invalid argument, throws the expected error', () => {
    expect(() => nock('http://example.test').persist('string')).to.throw(
      Error,
      'Invalid arguments: argument should be a boolean'
    )
  })
})
