'use strict'

const http = require('http')
const fs = require('fs')
const { beforeEach, test } = require('tap')
const proxyquire = require('proxyquire').noPreserveCache()
const nock = require('..')

require('./cleanup_after_each')()

beforeEach(done => {
  nockBack.setMode('wild')
  nockBack.fixtures = `${__dirname}/fixtures`
  done()
})

const nockBack = nock.back
const exists = fs.existsSync

function testNock(t) {
  let dataCalled = false

  const scope = nock('http://example.test')
    .get('/')
    .reply(200, 'Hello World!')

  http
    .request(
      {
        host: 'example.test',
        path: '/',
        port: 80,
      },
      res => {
        t.equal(res.statusCode, 200)
        res.once('end', () => {
          t.ok(dataCalled)
          scope.done()
          t.end()
        })
        res.on('data', data => {
          dataCalled = true
          t.ok(data instanceof Buffer, 'data should be a buffer')
          t.equal(data.toString(), 'Hello World!', 'response should match')
        })
      }
    )
    .end()
}

function nockBackWithFixture(t, scopesLoaded) {
  const scopesLength = scopesLoaded ? 1 : 0

  nockBack('goodRequest.json', function(done) {
    t.equal(this.scopes.length, scopesLength)
    http.get('http://www.google.com').end()
    this.assertScopesFinished()
    done()
    t.end()
  })
}

// TODO: This was added as a temporary patch. It's possible that we don't need
// both `goodRequest.json`/`nockBackWithFixture()` on google.com and a second
// pair on localhost. Consolidate them if possible. Otherwise remove this
// comment.
function nockBackWithFixtureLocalhost(t) {
  nockBack('goodRequestLocalhost.json', function(done) {
    t.equal(this.scopes.length, 0)

    const server = http.createServer((request, response) => {
      t.pass('server received a request')

      response.writeHead(200)
      response.end()
    })

    t.on('end', () => server.close())

    server.listen(() => {
      const request = http.request(
        {
          host: 'localhost',
          path: '/',
          port: server.address().port,
        },
        response => {
          t.is(200, response.statusCode)
          this.assertScopesFinished()
          done()
          t.end()
        }
      )

      request.on('error', t.error)
      request.end()
    })
  })
}

test('nockBack throws an exception when fixtures is not set', t => {
  nockBack.fixtures = undefined

  t.throws(nockBack, { message: 'Back requires nock.back.fixtures to be set' })
  t.end()
})

test('nockBack throws an exception when fixtureName is not a string', t => {
  t.throws(() => nockBack(), {
    message: 'Parameter fixtureName must be a string',
  })
  t.end()
})

test('nockBack returns a promise when neither options nor nockbackFn are specified', t => {
  nockBack('test-promise-fixture.json').then(params => {
    t.type(params.nockDone, 'function')
    t.type(params.context, 'object')
    t.end()
  })
})

test('nockBack throws an exception when a hook is not a function', t => {
  nockBack.setMode('dryrun')
  t.throws(
    () => nockBack('goodRequest.json', { before: 'not-a-function-innit' }),
    { message: 'processing hooks must be a function' }
  )
  t.end()
})

test('nockBack.setMode throws an exception on unknown mode', t => {
  t.throws(() => nockBack.setMode('bogus'), { message: 'Unknown mode: bogus' })
  t.end()
})

test('nockBack returns a promise when nockbackFn is not specified', t => {
  nockBack('test-promise-fixture.json', { test: 'options' }).then(params => {
    t.type(params.nockDone, 'function')
    t.type(params.context, 'object')
    t.end()
  })
})

test('with wild, normal nocks work', t => testNock(t))

test('wild enables net connect', t => {
  nock.disableNetConnect()
  nockBack.setMode('wild')
  // TODO: It would be nice if there were a cleaner way to assert that net
  // connect is allowed.
  nockBackWithFixtureLocalhost(t)
  t.end()
})

test("with wild, nock back doesn't do anything", t =>
  nockBackWithFixtureLocalhost(t))

test('nockBack dryrun tests', nw => {
  nw.beforeEach(done => {
    // Manually disable net connectivity to confirm that dryrun enables it.
    nock.disableNetConnect()
    nockBack.setMode('dryrun')
    done()
  })

  nw.test('goes to internet even when no nockBacks are running', t => {
    t.plan(2)

    const server = http.createServer((request, response) => {
      t.pass('server received a request')

      response.writeHead(200)
      response.end()
    })

    server.listen(() => {
      const request = http.request(
        {
          host: 'localhost',
          path: '/',
          port: server.address().port,
        },
        response => {
          t.is(200, response.statusCode)

          server.close(t.end)
        }
      )

      request.on('error', t.error)
      request.end()
    })
  })

  nw.test('normal nocks work', t => testNock(t))

  nw.test('uses recorded fixtures', t => nockBackWithFixture(t, true))

  nw.test("goes to internet, doesn't record new fixtures", t => {
    t.plan(5)

    let dataCalled = false

    const fixture = 'someDryrunFixture.json'
    const fixtureLoc = `${nockBack.fixtures}/${fixture}`

    t.false(exists(fixtureLoc))

    nockBack(fixture, done => {
      const server = http.createServer((request, response) => {
        t.pass('server received a request')

        response.writeHead(200)
        response.write('server served a response')
        response.end()
      })

      server.listen(() => {
        const request = http.request(
          {
            host: 'localhost',
            path: '/',
            port: server.address().port,
          },
          response => {
            t.is(200, response.statusCode)

            response.on('data', data => {
              dataCalled = true
            })

            response.on('end', () => {
              t.ok(dataCalled)
              t.false(exists(fixtureLoc))

              server.close(t.end)
            })
          }
        )

        request.on('error', t.error)
        request.end()
      })
    })
  })
  nw.end()
})

test('nockBack record tests', nw => {
  nw.beforeEach(done => {
    nockBack.setMode('record')
    done()
  })

  nw.test('it records when configured correctly', t => {
    t.plan(4)

    const fixture = 'someFixture.txt'
    const fixtureLoc = `${nockBack.fixtures}/${fixture}`

    t.false(exists(fixtureLoc))

    nockBack(fixture, done => {
      const server = http.createServer((request, response) => {
        t.pass('server received a request')

        response.writeHead(200)
        response.write('server served a response')
        response.end()
      })

      server.listen(() => {
        const request = http.request(
          {
            host: 'localhost',
            path: '/',
            port: server.address().port,
          },
          response => {
            done()

            t.is(200, response.statusCode)
            t.true(exists(fixtureLoc))

            fs.unlinkSync(fixtureLoc)

            server.close(t.end)
          }
        )

        request.on('error', t.error)
        request.end()
      })
    })
  })

  // Adding this test because there was an issue when not calling
  // nock.activate() after calling nock.restore().
  nw.test('it can record twice', t => {
    t.plan(4)

    const fixture = 'someFixture2.txt'
    const fixtureLoc = `${nockBack.fixtures}/${fixture}`

    t.false(exists(fixtureLoc))

    nockBack(fixture, function(done) {
      const server = http.createServer((request, response) => {
        t.pass('server received a request')

        response.writeHead(200)
        response.write('server served a response')
        response.end()
      })

      server.listen(() => {
        const request = http.request(
          {
            host: 'localhost',
            path: '/',
            port: server.address().port,
          },
          response => {
            done()

            t.is(200, response.statusCode)
            t.true(exists(fixtureLoc))

            fs.unlinkSync(fixtureLoc)

            server.close(t.end)
          }
        )

        request.on('error', t.error)
        request.end()
      })
    })
  })

  nw.test("it shouldn't allow outside calls", t => {
    const fixture = 'wrongUri.json'
    nockBack(fixture, function(done) {
      http
        .get('http://www.amazon.com', res => t.fail('Should not come here!'))
        .on('error', err => {
          t.equal(
            err.message,
            'Nock: Disallowed net connect for "www.amazon.com:80/"'
          )
          done()
          t.end()
        })
    })
  })

  nw.test('it loads your recorded tests', t => {
    nockBack('goodRequest.json', function(done) {
      t.true(this.scopes.length > 0)
      http.get('http://www.google.com').end()
      this.assertScopesFinished()
      done()
      t.end()
    })
  })

  nw.test('it can filter after recording', t => {
    const fixture = 'filteredFixture.json'
    const fixtureLoc = `${nockBack.fixtures}/${fixture}`

    t.false(exists(fixtureLoc))

    // You would do some filtering here, but for this test we'll just return
    // an empty array.
    const afterRecord = scopes => []

    nockBack(fixture, { afterRecord }, function(done) {
      const server = http.createServer((request, response) => {
        t.pass('server received a request')

        response.writeHead(200)
        response.write('server served a response')
        response.end()
      })

      server.listen(() => {
        const request = http.request(
          {
            host: 'localhost',
            path: '/',
            port: server.address().port,
          },
          response => {
            done()

            t.is(200, response.statusCode)
            t.true(exists(fixtureLoc))
            t.equal(this.scopes.length, 0)
            fs.unlinkSync(fixtureLoc)

            server.close(t.end)
          }
        )
        request.on('error', t.error)
        request.end()
      })
    })
    nw.end()
  })

  nw.test('it can format after recording', t => {
    const fixture = 'filteredFixture.json'
    const fixtureLoc = `${nockBack.fixtures}/${fixture}`

    t.false(exists(fixtureLoc))

    const afterRecord = scopes => 'string-response'

    nockBack(fixture, { afterRecord }, function(done) {
      const server = http.createServer((request, response) => {
        t.pass('server received a request')

        response.writeHead(200)
        response.write('server served a response')
        response.end()
      })

      server.listen(() => {
        const request = http.request(
          {
            host: 'localhost',
            path: '/',
            port: server.address().port,
          },
          response => {
            done()

            t.is(200, response.statusCode)
            t.true(exists(fixtureLoc))
            t.is(fs.readFileSync(fixtureLoc, 'utf8'), 'string-response')
            fs.unlinkSync(fixtureLoc)

            server.close(t.end)
          }
        )
        request.on('error', t.error)
        request.end()
      })
    })
    nw.end()
  })
})

test('nockBack lockdown tests', nw => {
  nw.beforeEach(done => {
    nockBack.setMode('lockdown')
    done()
  })

  nw.test('normal nocks work', t => testNock(t))

  nw.test('nock back loads scope', t => nockBackWithFixture(t, true))

  nw.test('no unnocked http calls work', t => {
    const req = http.request(
      {
        host: 'google.com',
        path: '/',
      },
      res => t.fail('Should not come here!')
    )

    req.on('error', err => {
      t.equal(
        err.message.trim(),
        'Nock: Disallowed net connect for "google.com:80/"'
      )
      t.end()
    })

    req.end()
  })

  nw.end()
})

test('nockBack dryrun throws the expected exception when fs is not available', t => {
  const nockBackWithoutFs = proxyquire('../lib/back', { fs: null })

  nockBackWithoutFs.fixtures = `${__dirname}/fixtures`
  t.throws(() => nockBackWithoutFs('goodRequest.json'), { message: 'no fs' })

  t.end()
})

test('nockBack record mode throws the expected exception when fs is not available', t => {
  const nockBackWithoutFs = proxyquire('../lib/back', { fs: null })
  nockBackWithoutFs.setMode('record')

  nockBackWithoutFs.fixtures = `${__dirname}/fixtures`
  t.throws(() => nockBackWithoutFs('goodRequest.json'), { message: 'no fs' })
  t.end()
})
