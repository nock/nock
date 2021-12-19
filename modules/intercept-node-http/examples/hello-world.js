const http = require('node:http')

const got = require('got')

const intercept = require('../index.js')

/**
 * Return a 200 response with a "Hello, world!" response body
 * for any request
 *
 * @param {import("../lib/client-request/types").NormalizedRequestOptions} options
 * @param {import("../lib/client-request/types").OverridenClientRequest} request
 */
function onIntercept(options, request) {
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
  const reset = intercept(onIntercept)

  console.log('Intercepted:')
  console.log(await got('https://example.com').text())

  console.log('\n\nNot Intercepted:')
  reset()
  console.log(await got('https://example.com').text())
}
