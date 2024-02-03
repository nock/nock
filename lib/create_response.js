'use strict'

const { headersArrayToObject } = require('./common')

/**
 * Creates a Fetch API `Response` instance from the given
 * `http.IncomingMessage` instance.
 * Inspired by: https://github.com/mswjs/interceptors/blob/04152ed914f8041272b6e92ed374216b8177e1b2/src/interceptors/ClientRequest/utils/createResponse.ts#L8
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
    message.statusCode,
  )
    ? null
    : new ReadableStream({
        start(controller) {
          message.on('data', chunk => controller.enqueue(chunk))
          message.on('end', () => controller.close())

          /**
           * @todo Should also listen to the "error" on the message
           * and forward it to the controller. Otherwise the stream
           * will pend indefinitely.
           */
        },
      })

  return new Response(responseBodyOrNull, {
    status: message.statusCode,
    statusText: message.statusMessage,
    headers: headersArrayToObject(message.rawHeaders),
  })
}

module.exports = { createResponse }
