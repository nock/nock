'use strict'

const fs = require('fs')
const http = require('http')
const nock = require('../')
const nockBack = nock.back
const querystring = require('querystring')
const rimraf = require('rimraf')
const { test } = require('tap')

const originalMode = nockBack.currentMode
nock.enableNetConnect()
nockBack.fixtures = `${__dirname}/fixtures`
nockBack.setMode('record')
const fixtureFilename = `recording_filters_test.json`;
const fixture = `${nockBack.fixtures}/${fixtureFilename}`

function rimrafOnEnd(t) {
  t.once('end', function() {
    rimraf.sync(fixture)
  })
}

function createServer(t) {
  return http.createServer((request, response) => {
    t.pass('server received a request')

    response.writeHead(200)
    response.write(`server served a response at ${new Date().getTime()}`)
    response.end()
  })
}

function createRequest(options, callback) {
  const baseOptions = {
    host: 'localhost',
    path: '/',
    method: 'GET',
  }
  return http.request({ ...baseOptions, ...options }, response => {
    const rawData = []
    response.on('data', chunk => rawData.push(chunk))
    response.once('end', chunk => {
      rawData.push(chunk)
      callback(rawData.join(''))
      response.resume()
    })
  })
}

test('nockBack passes filteringPath options', function(t) {
  t.plan(5)

  const server = createServer(t)
  const nockBackOptions = {
    before(scope) {
      scope.filteringPath = path =>
        path.replace(/timestamp=[0-9]+/, 'timestamp=1111')
    },
  }

  server.listen(() => {
    const { port } = server.address()

    nockBack(fixtureFilename, nockBackOptions, function(nockDone) {
      const requestForRecord = createRequest(
        {
          path: '/?timestamp=1111',
          port,
        },
        firstRawData => {
          nockDone()
          t.pass('nockBack records fixture')

          const fixtureContent = JSON.parse(
            fs.readFileSync(fixture, { encoding: 'utf8' })
          )
          t.equal(fixtureContent.length, 1)
          t.equal(fixtureContent[0].path, '/?timestamp=1111')

          nockBack(fixtureFilename, nockBackOptions, function(nockDone) {
            const request = createRequest(
              {
                path: '/?timestamp=2222',
                port,
              },
              secondRawData => {
                nockDone()

                t.equal(firstRawData, secondRawData)

                server.close(t.end)
              }
            )

            request.on('error', t.error)
            request.end()
          })
        }
      )

      requestForRecord.on('error', t.error)
      requestForRecord.end()
    })
  })

  rimrafOnEnd(t)
})

test('nockBack passes filteringRequestBody option', function(t) {
  t.plan(5)

  const server = createServer(t)
  const nockBackOptions = {
    before(scope) {
      scope.filteringRequestBody = (body, recordedBody) => {
        const regExp = /token=[a-z-]+/
        const recordedBodyMatched = recordedBody.match(regExp)

        if (recordedBodyMatched && regExp.test(body)) {
          return body.replace(regExp, recordedBodyMatched[0])
        }

        return body
      }
    },
  }

  server.listen(() => {
    const { port } = server.address()

    nockBack(fixtureFilename, nockBackOptions, function(nockDone) {
      const postData = querystring.stringify({ token: 'aaa-bbb-ccc' })
      const requestForRecord = createRequest(
        {
          port,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        firstRawData => {
          nockDone()
          t.pass('nockBack records fixture')

          const fixtureContent = JSON.parse(
            fs.readFileSync(fixture, { encoding: 'utf8' })
          )
          t.equal(fixtureContent.length, 1)
          t.equal(fixtureContent[0].body, 'token=aaa-bbb-ccc')

          nockBack(fixtureFilename, nockBackOptions, function(nockDone) {
            const secondPostData = querystring.stringify({
              token: 'ddd-eee-fff',
            })
            const request = createRequest(
              {
                port,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': Buffer.byteLength(postData),
                },
              },
              secondRawData => {
                nockDone()

                t.equal(firstRawData, secondRawData)

                server.close(t.end)
              }
            )

            request.write(secondPostData)
            request.on('error', t.error)
            request.end()
          })
        }
      )

      requestForRecord.write(postData)
      requestForRecord.on('error', t.error)
      requestForRecord.end()
    })
  })

  rimrafOnEnd(t)
})

test('teardown', function(t) {
  nockBack.setMode(originalMode)
  t.end()
})
