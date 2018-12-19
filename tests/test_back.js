'use strict'

const http = require('http')
const fs = require('fs')
const { test } = require('tap')
const proxyquire = require('proxyquire').noPreserveCache()
const nock = require('../.')

const nockBack = nock.back
const exists = fs.existsSync

nock.enableNetConnect()

let originalMode = nockBack.currentMode

function testNock(t) {
  let dataCalled = false

  const scope = nock('http://www.google.com')
    .get('/')
    .reply(200, 'Hello World!')

  http
    .request(
      {
        host: 'www.google.com',
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

// this is a temporary as we get rid of all the {skip: process.env.AIRPLANE}
// settings. When we are done with all, replace nockBackWithFixture and get
// rid of this function and the goodRequestLocalhost.json fixtures
function nockBackWithFixtureLocalhost(t, scopesLoaded) {
  const scopesLength = scopesLoaded ? 1 : 0

  nockBack('goodRequestLocalhost.json', function(done) {
    t.equal(this.scopes.length, scopesLength)

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
          this.assertScopesFinished()
          done()
          server.close(t.end)
        }
      )

      request.on('error', t.error)
      request.end()
    })
  })
}

function setOriginalModeOnEnd(t, nockBack) {
  t.once('end', () => nockBack.setMode(originalMode))
}

test('nockBack throws an exception when fixtures is not set', t => {
  nockBack.fixtures = undefined

  t.throws(nockBack, { message: 'Back requires nock.back.fixtures to be set' })
  t.end()
})

test('nockBack throws an exception when fixtureName is not a string', t => {
  nockBack.fixtures = __dirname + '/fixtures'

  t.throws(nockBack, { message: 'Parameter fixtureName must be a string' })
  t.end()
})

test('nockBack returns a promise when neither options nor nockbackFn are specified', t => {
  nockBack.fixtures = __dirname + '/fixtures'

  nockBack('test-promise-fixture.json').then(params => {
    t.type(params.nockDone, 'function')
    t.type(params.context, 'object')
    t.end()
  })
})

test('nockBack throws an exception when a hook is not a function', t => {
  nockBack.fixtures = __dirname + '/fixtures'
  nockBack.setMode('dryrun')
  setOriginalModeOnEnd(t, nockBack)

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
  nockBack.fixtures = __dirname + '/fixtures'

  nockBack('test-promise-fixture.json', { test: 'options' }).then(params => {
    t.type(params.nockDone, 'function')
    t.type(params.context, 'object')
    t.end()
  })
})

test('nockBack wild tests', nw => {
  // Manually disable net connectivity to confirm that dryrun enables it.
  nock.disableNetConnect()

  nockBack.fixtures = __dirname + '/fixtures'
  nockBack.setMode('wild')
  setOriginalModeOnEnd(nw, nockBack)

  nw.test('normal nocks work', t => testNock(t))

  nw.test("nock back doesn't do anything", t =>
    nockBackWithFixtureLocalhost(t, false)
  )

  nw.end()
})

test('nockBack dryrun tests', nw => {
  // Manually disable net connectivity to confirm that dryrun enables it.
  nock.disableNetConnect()

  nockBack.fixtures = __dirname + '/fixtures'
  nockBack.setMode('dryrun')
  setOriginalModeOnEnd(nw, nockBack)

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
    const fixtureLoc = nockBack.fixtures + '/' + fixture

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
  nockBack.setMode('record')

  nw.test('it records when configured correctly', t => {
    t.plan(4)

    nockBack.fixtures = __dirname + '/fixtures'

    const fixture = 'someFixture.txt'
    const fixtureLoc = nockBack.fixtures + '/' + fixture

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

    nockBack.fixtures = `${__dirname}/fixtures`

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
    nockBack.fixtures = `${__dirname}/fixtures`
    setOriginalModeOnEnd(nw, nockBack)
    const fixture = 'filteredFixture.json'
    const fixtureLoc = `${nockBack.fixtures}/${fixture}`

    t.false(exists(fixtureLoc))

    // You would do some filtering here, but for this test we'll just return
    // an empty array.
    const afterRecord = scopes => []

    nockBack(fixture, { afterRecord: afterRecord }, function(done) {
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
})

test('nockBack lockdown tests', nw => {
  nockBack.fixtures = __dirname + '/fixtures'
  nockBack.setMode('lockdown')
  setOriginalModeOnEnd(nw, nockBack)

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

  nockBackWithoutFs.fixtures = __dirname + '/fixtures'
  t.throws(() => nockBackWithoutFs('goodRequest.json'), { message: 'no fs' })

  t.end()
})

test('nockBack record mode throws the expected exception when fs is not available', t => {
  const nockBackWithoutFs = proxyquire('../lib/back', { fs: null })
  nockBackWithoutFs.setMode('record')
  setOriginalModeOnEnd(t, nockBackWithoutFs)

  nockBackWithoutFs.fixtures = __dirname + '/fixtures'
  t.throws(() => nockBackWithoutFs('goodRequest.json'), { message: 'no fs' })
  t.end()
})
