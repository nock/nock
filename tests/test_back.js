'use strict'

const crypto = require('crypto')
const http = require('http')
const fs = require('fs')
const { expect } = require('chai')
const path = require('path')
const rimraf = require('rimraf')
const sinon = require('sinon')
const proxyquire = require('proxyquire').preserveCache()
const nock = require('..')
const { startHttpServer } = require('./servers')

const { back: nockBack } = nock

function testNock(done) {
  const onData = sinon.spy()

  const scope = nock('http://www.example.test')
    .get('/')
    .reply(200, 'Hello World!')

  http
    .request(
      {
        host: 'www.example.test',
        path: '/',
        port: 80,
      },
      res => {
        expect(res.statusCode).to.equal(200)
        res.once('end', () => {
          expect(onData).to.have.been.called()
          scope.done()
          done()
        })
        res.on('data', data => {
          onData()
          expect(data).to.be.an.instanceOf(Buffer)
          expect(data.toString()).to.equal('Hello World!')
        })
      },
    )
    .end()
}

function nockBackWithFixture(mochaDone, scopesLoaded) {
  const scopesLength = scopesLoaded ? 1 : 0

  nockBack('good_request.json', function (nockDone) {
    expect(this.scopes).to.have.length(scopesLength)
    http.get('http://www.example.test/', () => {
      this.assertScopesFinished()
      nockDone()
      mochaDone()
    })
  })
}

const requestListener = (request, response) => {
  response.writeHead(217) // non-standard status code to ensure the response is not live
  response.write('server served a response')
  response.end()
}

// TODO: This was added as a temporary patch. It's possible that we don't need
// both `good_request.json`/`nockBackWithFixture()` on google.com and a second
// pair on localhost. Consolidate them if possible. Otherwise remove this
// comment.
function nockBackWithFixtureLocalhost(mochaDone) {
  nockBack('goodRequestLocalhost.json', function (nockDone) {
    expect(this.scopes).to.be.empty()

    startHttpServer(requestListener).then(server => {
      const request = http.request(
        {
          host: 'localhost',
          path: '/',
          port: server.address().port,
        },
        response => {
          expect(response.statusCode).to.equal(217)
          this.assertScopesFinished()
          nockDone()
          mochaDone()
        },
      )

      request.on('error', () => expect.fail())
      request.end()
    })
  })
}

describe('Nock Back', () => {
  beforeEach(() => {
    nockBack.fixtures = path.resolve(__dirname, 'fixtures')
  })

  it('should throw an exception when fixtures is not set', () => {
    nockBack.fixtures = undefined

    expect(nockBack).to.throw('Back requires nock.back.fixtures to be set')
  })

  it('should throw an exception when fixtureName is not a string', () => {
    expect(nockBack).to.throw('Parameter fixtureName must be a string')
  })

  it('should return a promise when neither options nor nockbackFn are specified', done => {
    nockBack('test-promise-fixture.json').then(({ nockDone, context }) => {
      expect(nockDone).to.be.a('function')
      expect(context).to.be.an('object')
      done()
    })
  })

  it('should allow template substitutions in recorded fixtures', done => {
    const mySecretApiKey = 'blah-blah'

    nockBack(
      'test-template-substitution-fixture.json',
      {
        substitutions: { SECRET: mySecretApiKey },
        after: scope => {
          expect(scope.interceptors[0].uri).to.eql('/?secret=blah-blah')
        },
      },
      function (nockDone) {
        http.get('http://example.test/?secret=blah-blah', () => {
          nockDone()
          done()
        })
      },
    )
  })

  it('should throw an exception when a hook is not a function', () => {
    expect(() =>
      nockBack('good_request.json', { before: 'not-a-function-innit' }),
    ).to.throw('processing hooks must be a function')
  })

  it('should return a promise when nockbackFn is not specified', done => {
    nockBack('test-promise-fixture.json', { test: 'options' }).then(
      ({ nockDone, context }) => {
        expect(nockDone).to.be.a('function')
        expect(context).to.be.an('object')
        done()
      },
    )
  })

  it('`setMode` throws an exception on unknown mode', () => {
    expect(() => nockBack.setMode('bogus')).to.throw('Unknown mode: bogus')
  })

  it('`assertScopesFinished` throws exception when Back still has pending scopes', done => {
    const fixtureName = 'good_request.json'
    const fixturePath = path.join(nockBack.fixtures, fixtureName)
    nockBack(fixtureName, function (nockDone) {
      expect(() => this.assertScopesFinished()).to.throw(
        `["GET http://www.example.test:80/"] was not used, consider removing ${fixturePath} to rerecord fixture`,
      )
      nockDone()
      done()
    })
  })

  describe('wild mode', () => {
    beforeEach(() => {
      nockBack.setMode('wild')
    })

    it('should allow normal nocks to work', testNock)

    it('should enable net connect', done => {
      nock.disableNetConnect()
      nockBack.setMode('wild')
      // TODO: It would be nice if there were a cleaner way to assert that net
      // connect is allowed.
      nockBackWithFixtureLocalhost(done)
    })

    it(
      "shouldn't do anything when fixtures are present",
      nockBackWithFixtureLocalhost,
    )
  })

  describe('dryrun mode', () => {
    beforeEach(() => {
      // Manually disable net connectivity to confirm that dryrun enables it.
      nock.disableNetConnect()
      nockBack.setMode('dryrun')
    })

    it('goes to internet even when no nockBacks are running', done => {
      startHttpServer(requestListener).then(server => {
        const request = http.request(
          {
            host: 'localhost',
            path: '/',
            port: server.address().port,
          },
          response => {
            expect(response.statusCode).to.equal(217)
            done()
          },
        )

        request.on('error', () => expect.fail())
        request.end()
      })
    })

    it('normal nocks work', testNock)

    it('uses recorded fixtures', done => nockBackWithFixture(done, true))

    it("goes to internet, doesn't record new fixtures", done => {
      const onData = sinon.spy()

      const fixture = 'someDryrunFixture.json'
      const fixtureLoc = `${nockBack.fixtures}/${fixture}`

      expect(fs.existsSync(fixtureLoc)).to.be.false()

      nockBack(fixture, () => {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              expect(response.statusCode).to.equal(217)

              response.on('data', onData)

              response.on('end', () => {
                expect(onData).to.have.been.called()
                expect(fs.existsSync(fixtureLoc)).to.be.false()
                done()
              })
            },
          )

          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should throw the expected exception when fs is not available', () => {
      const nockBackWithoutFs = proxyquire('../lib/back', { fs: null })
      nockBackWithoutFs.setMode('dryrun')

      nockBackWithoutFs.fixtures = path.resolve(__dirname, 'fixtures')
      expect(() => nockBackWithoutFs('good_request.json')).to.throw('no fs')
    })
  })

  describe('record mode', () => {
    let fixture
    let fixtureLoc

    beforeEach(() => {
      // random fixture file so tests don't interfere with each other
      const token = crypto.randomBytes(4).toString('hex')
      fixture = `temp_${token}.json`
      fixtureLoc = path.resolve(__dirname, 'fixtures', fixture)
      nockBack.setMode('record')
    })

    after(() => {
      rimraf.sync(path.resolve(__dirname, 'fixtures', 'temp_*.json'))
    })

    it('should record when configured correctly', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      nockBack(fixture, nockDone => {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()
              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              done()
            },
          )

          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should record template keys into fixtures rather than secrets', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      const mySecretApiKey = 'sooper-secret'

      nockBack(
        fixture,
        {
          substitutions: { SECRET: mySecretApiKey },
        },
        function (nockDone) {
          startHttpServer(requestListener).then(server => {
            const request = http.request(
              {
                host: 'localhost',
                path: '/?secret=sooper-secret',
                port: server.address().port,
              },
              response => {
                response.once('end', () => {
                  nockDone()
                  const fixtureContent = fs.readFileSync(fixtureLoc, 'utf8')
                  expect(response.statusCode).to.equal(217)
                  expect(fixtureContent).to.contain('{{ SECRET }}')
                  done()
                })

                response.resume()
              },
            )

            request.on('error', () => expect.fail())
            request.end()
          })
        },
      )
    })

    it('should record the expected data', done => {
      nockBack(fixture, nockDone => {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
              method: 'GET',
            },
            response => {
              response.once('end', () => {
                nockDone()

                const fixtureContent = JSON.parse(
                  fs.readFileSync(fixtureLoc).toString('utf8'),
                )
                expect(fixtureContent).to.have.length(1)

                const [firstFixture] = fixtureContent
                expect(firstFixture).to.include({
                  method: 'GET',
                  path: '/',
                  status: 217,
                })

                done()
              })

              response.resume()
            },
          )

          request.on('error', err => expect.fail(err.message))
          request.end()
        })
      })
    })

    // Adding this test because there was an issue when not calling
    // nock.activate() after calling nock.restore().
    it('can record twice', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      nockBack(fixture, function (nockDone) {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()

              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              done()
            },
          )

          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it("shouldn't allow outside calls", done => {
      nockBack('wrong_uri.json', nockDone => {
        http
          .get('http://other.example.test', () => expect.fail())
          .on('error', err => {
            expect(err.message).to.equal(
              'Nock: Disallowed net connect for "other.example.test:80/"',
            )
            nockDone()
            done()
          })
      })
    })

    it('should load recorded tests', done => {
      nockBack('good_request.json', function (nockDone) {
        expect(this.scopes).to.have.lengthOf.at.least(1)
        http.get('http://www.example.test/', () => {
          this.assertScopesFinished()
          nockDone()
          done()
        })
      })
    })

    it('should filter after recording', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      // You would do some filtering here, but for this test we'll just return
      // an empty array.
      const afterRecord = () => []

      nockBack(fixture, { afterRecord }, function (nockDone) {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()

              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              expect(this.scopes).to.be.empty()
              done()
            },
          )
          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should format after recording', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      const afterRecord = () => 'string-response'

      nockBack(fixture, { afterRecord }, function (nockDone) {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()

              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              expect(fs.readFileSync(fixtureLoc, 'utf8')).to.equal(
                'string-response',
              )
              done()
            },
          )
          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should pass custom options to recorder', done => {
      nockBack(
        fixture,
        { recorder: { enable_reqheaders_recording: true } },
        nockDone => {
          startHttpServer(requestListener).then(server => {
            const request = http.request(
              {
                host: 'localhost',
                path: '/',
                port: server.address().port,
                method: 'GET',
              },
              response => {
                response.once('end', () => {
                  nockDone()

                  const fixtureContent = JSON.parse(
                    fs.readFileSync(fixtureLoc).toString('utf8'),
                  )

                  expect(fixtureContent).to.have.length(1)
                  expect(fixtureContent[0].reqheaders).to.be.ok()

                  done()
                })
                response.resume()
              },
            )

            request.on('error', () => expect.fail())
            request.end()
          })
        },
      )
    })

    it('should throw the expected exception when fs is not available', () => {
      const nockBackWithoutFs = proxyquire('../lib/back', { fs: null })
      nockBackWithoutFs.setMode('record')

      nockBackWithoutFs.fixtures = path.resolve(__dirname, 'fixtures')
      expect(() => nockBackWithoutFs('good_request.json')).to.throw('no fs')
    })
  })

  describe('update mode', () => {
    let fixture
    let fixtureLoc
    let fixturePath

    beforeEach(() => {
      // random fixture file so tests don't interfere with each other
      const token = crypto.randomBytes(4).toString('hex')
      fixture = `temp_${token}.json`
      fixtureLoc = path.resolve(__dirname, 'fixtures', fixture)
      fixturePath = path.resolve(__dirname, 'fixtures')
      nockBack.setMode('update')
      fs.copyFileSync(
        path.resolve(fixturePath, 'wrong_uri.json'),
        path.resolve(fixturePath, 'temp_wrong_uri.json'),
      )
    })

    after(() => {
      rimraf.sync(path.resolve(__dirname, 'fixtures', 'temp_*.json'))
    })

    it('should record when configured correctly', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      nockBack(fixture, nockDone => {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()

              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              done()
            },
          )

          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should record template keys into fixtures rather than secrets', done => {
      const mySecretApiKey = 'sooper-secret'

      nockBack(
        fixture,
        {
          substitutions: { SECRET: mySecretApiKey },
        },
        function (nockDone) {
          startHttpServer(requestListener).then(server => {
            const request = http.request(
              {
                host: 'localhost',
                path: '/?secret=sooper-secret',
                port: server.address().port,
              },
              response => {
                response.once('end', () => {
                  nockDone()
                  const fixtureContent = fs.readFileSync(fixtureLoc, 'utf8')
                  expect(response.statusCode).to.equal(217)
                  expect(fixtureContent).to.contain('{{ SECRET }}')
                  done()
                })

                response.resume()
              },
            )

            request.on('error', () => expect.fail())
            request.end()
          })
        },
      )
    })

    it('should record the expected data', done => {
      nockBack(fixture, nockDone => {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
              method: 'GET',
            },
            response => {
              response.once('end', () => {
                nockDone()

                const fixtureContent = JSON.parse(
                  fs.readFileSync(fixtureLoc).toString('utf8'),
                )
                expect(fixtureContent).to.have.length(1)

                const [firstFixture] = fixtureContent
                expect(firstFixture).to.include({
                  method: 'GET',
                  path: '/',
                  status: 217,
                })

                done()
              })

              response.resume()
            },
          )

          request.on('error', err => expect.fail(err.message))
          request.end()
        })
      })
    })

    // Adding this test because there was an issue when not calling
    // nock.activate() after calling nock.restore().
    it('can record twice', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      nockBack(fixture, function (nockDone) {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()

              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              done()
            },
          )

          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should allow outside calls', done => {
      nockBack('temp_wrong_uri.json', nockDone => {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()
              expect(response.statusCode).to.equal(217)
              expect(
                fs.existsSync(`${fixturePath}/temp_wrong_uri.json`),
              ).to.be.true()
              done()
            },
          )

          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it("shouldn't load recorded tests", done => {
      fs.copyFileSync(
        path.resolve(fixturePath, 'good_request.json'),
        path.resolve(fixturePath, 'temp_good_request.json'),
      )
      nockBack('temp_good_request.json', function (nockDone) {
        expect(this.scopes).to.have.lengthOf.at.least(0)
        http
          .get('http://www.example.test/', () => {
            expect.fail()
          })
          .on('error', () => {
            nockDone()
            done()
          })
      })
    })

    it('should filter after recording', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      // You would do some filtering here, but for this test we'll just return
      // an empty array.
      const afterRecord = () => []

      nockBack(fixture, { afterRecord }, function (nockDone) {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()

              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              expect(this.scopes).to.be.empty()
              done()
            },
          )
          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should format after recording', done => {
      expect(fs.existsSync(fixtureLoc)).to.be.false()

      const afterRecord = () => 'string-response'

      nockBack(fixture, { afterRecord }, function (nockDone) {
        startHttpServer(requestListener).then(server => {
          const request = http.request(
            {
              host: 'localhost',
              path: '/',
              port: server.address().port,
            },
            response => {
              nockDone()

              expect(response.statusCode).to.equal(217)
              expect(fs.existsSync(fixtureLoc)).to.be.true()
              expect(fs.readFileSync(fixtureLoc, 'utf8')).to.equal(
                'string-response',
              )
              done()
            },
          )
          request.on('error', () => expect.fail())
          request.end()
        })
      })
    })

    it('should pass custom options to recorder', done => {
      nockBack(
        fixture,
        { recorder: { enable_reqheaders_recording: true } },
        nockDone => {
          startHttpServer(requestListener).then(server => {
            const request = http.request(
              {
                host: 'localhost',
                path: '/',
                port: server.address().port,
                method: 'GET',
              },
              response => {
                response.once('end', () => {
                  nockDone()

                  const fixtureContent = JSON.parse(
                    fs.readFileSync(fixtureLoc).toString('utf8'),
                  )

                  expect(fixtureContent).to.have.length(1)
                  expect(fixtureContent[0].reqheaders).to.be.ok()

                  done()
                })
                response.resume()
              },
            )

            request.on('error', () => expect.fail())
            request.end()
          })
        },
      )
    })

    it('should throw the expected exception when fs is not available', () => {
      const nockBackWithoutFs = proxyquire('../lib/back', { fs: null })
      nockBackWithoutFs.setMode('update')

      nockBackWithoutFs.fixtures = path.resolve(__dirname, 'fixtures')
      expect(() => nockBackWithoutFs('good_request.json')).to.throw('no fs')
    })
  })

  describe('lockdown mode', () => {
    beforeEach(() => {
      nockBack.setMode('lockdown')
    })

    it('normal nocks work', testNock)

    it('nock back loads scope', done => nockBackWithFixture(done, true))

    it('no unnocked http calls work', done => {
      const req = http.request(
        {
          host: 'other.example.test',
          path: '/',
        },
        () => expect.fail('Should not come here!'),
      )

      req.on('error', err => {
        expect(err.message.trim()).to.equal(
          'Nock: Disallowed net connect for "other.example.test:80/"',
        )
        done()
      })

      req.end()
    })
  })
})
