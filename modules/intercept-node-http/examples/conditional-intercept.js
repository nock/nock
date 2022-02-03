const http = require('node:http')

const got = require('got')

const intercept = require('../index.js')

/**
 * If request goes to example.com, respond with a mocked "Hello World" response.
 * Otherwise let the request pass through
 *
 * @param {import("../lib/client-request/types").NormalizedRequestOptions} options
 * @param {import("../lib/client-request/types").OverridenClientRequest} request
 */
function onIntercept(options, request) {
  if (options.hostname === 'example.com') {
    return request.nockSendRealRequest()
  }

  const response = new http.IncomingMessage(request.socket)

  // (1) set response header data
  response.statusCode = 200
  response.rawHeaders = []
  response.headers = {}

  // @ts-expect-error - no idea why `.req` is not typed on ClientRequest
  request.res = response
  // @ts-expect-error - no idea why `.res` is not typed on IncomingMessage
  response.req = request

  request.emit('response', response)

  // (2) set response body data
  response.push('Hello, world!')

  // (3) finish the response
  response.complete = true
  response.push(null)
}

run()

async function run() {
  intercept(onIntercept)

  console.log(`await got('https://example.com').text()`)
  console.log(await got('https://example.com').text())

  console.log(`await got('https://google.com').text()`)
  console.log(await got('https://google.com').text())
}
