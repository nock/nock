'use strict'

const zlib = require('node:zlib')
const { headersArrayToObject } = require('./common')
const { STATUS_CODES } = require('http')

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
 * @param {import('node:http').IncomingMessage} message
 */
function createResponse(message) {
  const isGzipped = ['x-gzip', 'gzip'].includes(
    message.headers['content-encoding'],
  )
  const responseBodyOrNull = responseStatusCodesWithoutBody.includes(
    message.statusCode,
  )
    ? null
    : new ReadableStream({
        start(controller) {
          message.on('data', chunk => {
            if (isGzipped) {
              // https://github.com/nodejs/node/blob/0161ad0baf87a0009101ce00b22b874ad6fc5d88/deps/undici/src/lib/fetch/index.js#L2178
              controller.enqueue(
                zlib.gunzipSync(chunk, {
                  flush: zlib.constants.Z_SYNC_FLUSH,
                  finishFlush: zlib.constants.Z_SYNC_FLUSH,
                }),
              )
            } else {
              controller.enqueue(chunk)
            }
          })
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
    statusText: STATUS_CODES[message.statusCode],
    headers: headersArrayToObject(message.rawHeaders),
  })
}

module.exports = { createResponse }
