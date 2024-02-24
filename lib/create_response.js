'use strict'

const zlib = require('node:zlib')
const { headersArrayToObject } = require('./common')
const { STATUS_CODES } = require('http')
const { pipeline, Readable } = require('node:stream')

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
  // https://github.com/Uzlopak/undici/blob/main/lib/fetch/index.js#L2031
  const decoders = []
  const codings =
    message.headers['content-encoding']
      ?.toLowerCase()
      .split(',')
      .map(x => x.trim())
      .reverse() || []
  for (const coding of codings) {
    if (coding === 'gzip' || coding === 'x-gzip') {
      decoders.push(
        zlib.createGunzip({
          flush: zlib.constants.Z_SYNC_FLUSH,
          finishFlush: zlib.constants.Z_SYNC_FLUSH,
        }),
      )
    } else if (coding === 'deflate') {
      decoders.push(zlib.createInflate())
    } else if (coding === 'br') {
      decoders.push(zlib.createBrotliDecompress())
    } else {
      decoders.length = 0
      break
    }
  }

  const chunks = []
  const responseBodyOrNull = responseStatusCodesWithoutBody.includes(
    message.statusCode,
  )
    ? null
    : new ReadableStream({
        start(controller) {
          message.on('data', chunk => chunks.push(chunk))
          message.on('end', () => {
            pipeline(
              Readable.from(chunks),
              ...decoders,
              async function* (source) {
                for await (const chunk of source) {
                  yield controller.enqueue(chunk)
                }
              },
              error => {
                if (error) {
                  controller.error(error)
                } else {
                  controller.close()
                }
              },
            )
          })

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
