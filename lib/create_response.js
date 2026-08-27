'use strict'

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
 * @param {import('http').IncomingMessage} message
 * @param {AbortSignal} signal
 */
function createResponse(message, signal) {
  const responseBodyOrNull = responseStatusCodesWithoutBody.includes(
    message.statusCode || 200,
  )
    ? null
    : new ReadableStream({
        start(controller) {
          message.on('data', chunk => controller.enqueue(chunk))
          message.on('end', () => controller.close())
          message.on('error', error => controller.error(error))
          signal.addEventListener('abort', () => message.destroy(signal.reason))
        },
        cancel() {
          message.destroy()
        },
      })

  const rawHeaders = new Headers()
  for (let i = 0; i < message.rawHeaders.length; i += 2) {
    rawHeaders.append(message.rawHeaders[i], message.rawHeaders[i + 1])
  }

  // @mswjs/interceptors supports rawHeaders. https://github.com/mswjs/interceptors/pull/598
  const response = new Response(responseBodyOrNull, {
    status: message.statusCode,
    statusText: message.statusMessage || STATUS_CODES[message.statusCode],
    headers: rawHeaders,
  })

  return response
}

function requestWantsKeepAlive(rawRequest) {
  if (!rawRequest || typeof rawRequest.getHeader !== 'function') {
    return false
  }
  const connection = rawRequest.getHeader('connection')
  return (
    typeof connection === 'string' && connection.toLowerCase() === 'keep-alive'
  )
}

/**
 * Interceptors copy this Fetch response onto the real socket. A keep-alive
 * client will not emit `end` unless the response has Content-Length or is
 * chunked, because Fetch strips the Connection header before Nock sees it.
 * https://github.com/nock/nock/issues/3001
 */
async function respondWith(controller, response, rawRequest) {
  if (
    !requestWantsKeepAlive(rawRequest) ||
    response.headers.has('content-length') ||
    response.headers.has('transfer-encoding')
  ) {
    controller.respondWith(response)
    return
  }

  const body = await response.arrayBuffer()
  const headers = new Headers(response.headers)
  headers.set('Content-Length', String(body.byteLength))
  const bodyInit = responseStatusCodesWithoutBody.includes(response.status)
    ? null
    : body
  controller.respondWith(
    new Response(bodyInit, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  )
}

module.exports = { createResponse, respondWith }
