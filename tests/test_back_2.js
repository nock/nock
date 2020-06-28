'use strict'

const http = require('http')
const fs = require('fs')
const sinon = require('sinon')
const { expect } = require('chai')
const { beforeEach, afterEach, test } = require('tap')
const rimraf = require('rimraf')
const nock = require('..')
const { back: nockBack } = nock

require('./setup')
require('./cleanup_after_each')()

const fixture = `${__dirname}/fixtures/recording_test.json`
beforeEach(done => {
  rimraf.sync(fixture)

  nockBack.fixtures = `${__dirname}/fixtures`
  nockBack.setMode('record')

  done()
})

afterEach(done => {
  rimraf.sync(fixture)
  done()
})

test('recording', t => {
  const onRequest = sinon.spy()

  nockBack('recording_test.json', function (nockDone) {
    const server = http.createServer((request, response) => {
      onRequest()
      response.writeHead(301)
      response.write('server served a response')
      response.end()
    })
    t.once('end', () => server.close())

    server.listen(() => {
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

            expect(onRequest).to.have.been.calledOnce()

            const fixtureContent = JSON.parse(
              fs.readFileSync(fixture, { encoding: 'utf8' })
            )
            expect(fixtureContent).to.have.length(1)

            const [firstFixture] = fixtureContent
            expect(firstFixture).to.include({
              method: 'GET',
              path: '/',
              status: 301,
            })

            server.close(t.end)
          })

          response.resume()
        }
      )

      request.on('error', t.error)
      request.end()
    })
  })
})

test('passes custom options to recorder', t => {
  const onRequest = sinon.spy()

  nockBack(
    'recording_test.json',
    { recorder: { enable_reqheaders_recording: true } },
    function (nockDone) {
      const server = http.createServer((request, response) => {
        onRequest()
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
            method: 'GET',
          },
          response => {
            response.once('end', () => {
              nockDone()

              expect(onRequest).to.have.been.calledOnce()

              const fixtureContent = JSON.parse(
                fs.readFileSync(fixture, { encoding: 'utf8' })
              )

              expect(fixtureContent).to.have.length(1)
              expect(fixtureContent[0].reqheaders).to.be.ok()

              server.close(t.end)
            })
            response.resume()
          }
        )

        request.on('error', t.error)
        request.end()
      })
    }
  )
})
