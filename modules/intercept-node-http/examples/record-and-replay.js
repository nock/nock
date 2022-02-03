const http = require('node:http')

const got = require('got')

const intercept = require('../index.js')

let recordedHeaders
let recordedStatusCode
let recordedData

/**
 * Record the first intercepted response and return it for all
 * subsequent requests.
 *
 * @param {import("../lib/client-request/types").NormalizedRequestOptions} options
 * @param {import("../lib/client-request/types").OverridenClientRequest} overridenRequest
 */
function onIntercept(options, overridenRequest) {
  if (!recordedData) {
    console.log('\nRECORDING MOCK\n')
    const realRequest = overridenRequest.nockSendRealRequest()

    realRequest.on('response', response => {
      recordedStatusCode = response.statusCode
      recordedHeaders = response.headers

      const chunks = []
      response.on('data', chunk => {
        chunks.push(chunk.toString('base64'))
      })
      response.on('end', () => {
        recordedData = chunks
        console.log('request recorded')
      })
    })
    return
  }

  console.log('\nREPLAYING MOCK\n')

  // intercept
  const response = new http.IncomingMessage(overridenRequest.socket)

  // (1) set response header data
  response.statusCode = recordedStatusCode
  response.headers = recordedHeaders

  overridenRequest.res = response
  response.req = overridenRequest

  overridenRequest.emit('response', response)

  // (2) set response body data
  for (const chunk of recordedData) {
    response.push(Buffer.from(chunk, 'base64'))
  }

  // (3) finish the response
  response.complete = true
  response.push(null)
}

run()

async function run() {
  intercept(onIntercept)

  const realResponse = await got('https://example.com/').text()
  console.log(`real response`)
  console.log(`${realResponse.substr(0, 64)}...`)

  const mockedResponse = await got('https://example.com/').text()
  console.log(`mocked response`)
  console.log(`${mockedResponse.substr(0, 64)}...`)
}
