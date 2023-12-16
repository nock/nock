const { IncomingMessage } = require('http')
const { headersArrayToObject } = require('./common')

/**
 * Creates a Fetch API `Response` instance from the given
 * `http.IncomingMessage` instance.
 * Inspired by: https://github.com/mswjs/interceptors/blob/04152ed914f8041272b6e92ed374216b8177e1b2/src/interceptors/ClientRequest/utils/createResponse.ts#L8
 * TODO: maybe MSW can export this? so no duplicate code
 */

/**
 * Response status codes for responses that cannot have body.
 * @see https://fetch.spec.whatwg.org/#statuses
 */
const responseStatusCodesWithoutBody = [204, 205, 304]

/**
 * @param {IncomingMessage} message 
 */
function createResponse(message) {
  const responseBodyOrNull = responseStatusCodesWithoutBody.includes(
    message.statusCode || 200
  )
    ? null
    : new ReadableStream({
      start(controller) {
        message.on('data', (chunk) => controller.enqueue(chunk))
        message.on('end', () => controller.close())

        /**
         * @todo Should also listen to the "error" on the message
         * and forward it to the controller. Otherwise the stream
         * will pend indefinitely.
         */
      },
    })

  const lowercaseHeaders = headersArrayToObject(message.rawHeaders)
  const headers = {}

  // TODO, DISCUSS BEFORE MERGE: temp hack to bring back the original header name in the least intrusive way.
  // I think the mswjs/interceptors needs to expose better API for rawHeaders mocking.
  for (let i = 0; i < message.rawHeaders.length; i+=2) {
    const rawHeader = message.rawHeaders[i]
    const lowerRawHeader = message.rawHeaders[i].toLowerCase()
    headers[rawHeader] = lowercaseHeaders[lowerRawHeader]
  }

  const response = new Response(responseBodyOrNull, {
    status: message.statusCode,
    statusText: message.statusMessage,
    headers,
  })

  // reset set-cookie headers for response.headers.cookies value to be correct
  if (lowercaseHeaders['set-cookie']) {
    response.headers.delete('set-cookie')
    lowercaseHeaders['set-cookie'].map(c => response.headers.append('set-cookie', c))
  }

  return response
}

module.exports = { createResponse }