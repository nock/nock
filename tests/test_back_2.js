'use strict'

const http = require('http')
const fs = require('fs')
const { beforeEach, afterEach, test } = require('tap')
const rimraf = require('rimraf')
const nock = require('..')

const nockBack = nock.back

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
  t.plan(5)

  nockBack('recording_test.json', function(nockDone) {
    const server = http.createServer((request, response) => {
      t.pass('server received a request')

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

            const fixtureContent = JSON.parse(
              fs.readFileSync(fixture, { encoding: 'utf8' })
            )
            t.equal(fixtureContent.length, 1)

            const [firstFixture] = fixtureContent
            t.equal(firstFixture.method, 'GET')
            t.equal(firstFixture.path, '/')
            t.equal(firstFixture.status, 301)

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
  t.plan(3)

  nockBack(
    'recording_test.json',
    { recorder: { enable_reqheaders_recording: true } },
    function(nockDone) {
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
            method: 'GET',
          },
          response => {
            response.once('end', () => {
              nockDone()

              const fixtureContent = JSON.parse(
                fs.readFileSync(fixture, { encoding: 'utf8' })
              )

              t.equal(fixtureContent.length, 1)
              t.ok(fixtureContent[0].reqheaders)

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
