'use strict'

const { STATUS_CODES } = require('http')
const stream = require('node:stream')
const util = require('node:util')
const { playback_interceptor: debug } = require('./debug')
const common = require('./common')
const { FetchResponse } = require('@mswjs/interceptors')

function parseFullReplyResult(fullReplyResult) {
  debug('full response from callback result: %j', fullReplyResult)

  if (!Array.isArray(fullReplyResult)) {
    throw Error('A single function provided to .reply MUST return an array')
  }

  if (fullReplyResult.length > 3) {
    throw Error(
      'The array returned from the .reply callback contains too many values',
    )
  }

  const [status, body = '', headers] = fullReplyResult

  if (!Number.isInteger(status)) {
    throw new Error(`Invalid ${typeof status} value for status code`)
  }

  const rawHeaders = common.headersInputToRawArray(headers)
  debug('response.rawHeaders after reply: %j', rawHeaders)

  return [status, body, rawHeaders]
}

/**
 * Determine which of the default headers should be added to the response.
 *
 * Don't include any defaults whose case-insensitive keys are already on the response.
 */
function selectDefaultHeaders(existingHeaders, defaultHeaders) {
  if (!defaultHeaders.length) {
    return [] // return early if we don't need to bother
  }

  const definedHeaders = new Set()
  const result = []

  common.forEachHeader(existingHeaders, (_, fieldName) => {
    definedHeaders.add(fieldName.toLowerCase())
  })
  common.forEachHeader(defaultHeaders, (value, fieldName) => {
    if (!definedHeaders.has(fieldName.toLowerCase())) {
      result.push([fieldName, value])
    }
  })

  return result
}

// Presents a list of Buffers as a Readable
class ReadableBuffers extends stream.Readable {
  constructor(buffers) {
    super()

    this.buffers = buffers
  }

  _read(_size) {
    while (this.buffers.length) {
      if (!this.push(this.buffers.shift())) {
        return
      }
    }
    this.push(null)
  }
}

function convertBodyToStream(body) {
  if (common.isStream(body)) {
    return body
  }

  if (body === undefined) {
    return new ReadableBuffers([])
  }

  if (Buffer.isBuffer(body)) {
    return new ReadableBuffers([body])
  }

  if (typeof body !== 'string') {
    body = JSON.stringify(body)
  }

  return new ReadableBuffers([Buffer.from(body)])
}

/**
 * Play back an interceptor using the given request and mock response.
 *
 * @param {Object} param0
 * @param {Request} param0.decompressedRequest
 * @param {string} param0.requestBodyString
 * @param {boolean} param0.requestBodyIsUtf8Representable
 * @param {import('./interceptor').Interceptor} param0.interceptor
 */
async function playbackInterceptor({
  decompressedRequest,
  interceptor,
  requestBodyString,
  requestBodyIsUtf8Representable,
}) {
  const { logger } = interceptor.scope
  interceptor.scope.emit(
    'request',
    decompressedRequest,
    interceptor,
    requestBodyString,
  )

  if (typeof interceptor.errorMessage !== 'undefined') {
    let error
    if (typeof interceptor.errorMessage === 'object') {
      error = interceptor.errorMessage
    } else {
      error = new Error(interceptor.errorMessage)
    }

    await new Promise(resolve =>
      common.setTimeout(resolve, interceptor.delayBodyInMs),
    )
    throw error
  }

  // TODO: MAJOR: Don't tack the request onto the interceptor.
  // The only reason we do this is so that it's available inside reply functions.
  // It would be better to pass the request as an argument to the functions instead.
  // Not adding the req as a third arg now because it should first be decided if (path, body, req)
  // is the signature we want to go with going forward.
  interceptor.req = decompressedRequest
  logger('response.rawHeaders:', interceptor.rawHeaders)

  // .reply(status, replyFunction)
  if (interceptor.replyFunction) {
    let fn = interceptor.replyFunction
    if (fn.length === 2) {
      // Handle the case of an async reply function, the third parameter being the callback.
      fn = util.promisify(fn)
    }

    // At this point `fn` is either a synchronous function or a promise-returning function;
    // wrapping in `Promise.resolve` makes it into a promise either way.
    // TODO: should we send the entire request instead?
    return Promise.resolve(fn.call(interceptor, decompressedRequest))
      .then(continueWithResponseBody)
      .catch(err => {
        throw err
      })
  }
  // .reply(fullReplyFunction)
  else if (interceptor.fullReplyFunction) {
    let fn = interceptor.fullReplyFunction
    if (fn.length === 2) {
      fn = util.promisify(fn)
    }

    // TODO: should we send the entire request instead?
    return Promise.resolve(fn.call(interceptor, decompressedRequest))
      .then(continueWithFullResponse)
      .catch(err => {
        throw err
      })
  }

  if (
    common.isContentEncoded(interceptor.headers) &&
    !common.isStream(interceptor.body)
  ) {
    //  If the content is encoded we know that the response body *must* be an array
    //  of response buffers which should be mocked one by one.
    //  (otherwise decompressions after the first one fails as unzip expects to receive
    //  buffer by buffer and not one single merged buffer)
    const bufferData = Array.isArray(interceptor.body)
      ? interceptor.body
      : [interceptor.body]
    const responseBuffers = bufferData.map(data => Buffer.from(data, 'hex'))
    const responseBody = new ReadableBuffers(responseBuffers)
    return continueWithResponseBody(responseBody)
  }

  // If we get to this point, the body is either a string or an object that
  // will eventually be JSON stringified.
  let responseBody = interceptor.body

  // If the request was not UTF8-representable then we assume that the
  // response won't be either. In that case we send the response as a Buffer
  // object as that's what the client will expect.
  if (!requestBodyIsUtf8Representable && typeof responseBody === 'string') {
    // Try to create the buffer from the interceptor's body response as hex.
    responseBody = Buffer.from(responseBody, 'hex')

    // Creating buffers does not necessarily throw errors; check for difference in size.
    if (
      !responseBody ||
      (interceptor.body.length > 0 && responseBody.length === 0)
    ) {
      // We fallback on constructing buffer from utf8 representation of the body.
      responseBody = Buffer.from(interceptor.body, 'utf8')
    }
  }

  return continueWithResponseBody(responseBody)

  function continueWithFullResponse(fullReplyResult) {
    const [status, responseBody, rawHeaders] =
      parseFullReplyResult(fullReplyResult)
    return continueWithResponseBody(responseBody, status, rawHeaders)
  }

  function prepareResponseHeaders(body, responseHeaders) {
    const defaultHeaders = [...interceptor.scope._defaultReplyHeaders]
    const rawHeaders = []

    // Include a JSON content type when JSON.stringify is called on the body.
    // This is a convenience added by Nock that has no analog in Node. It's added to the
    // defaults, so it will be ignored if the caller explicitly provided the header already.
    const isJSON =
      body !== undefined &&
      typeof body !== 'string' &&
      !Buffer.isBuffer(body) &&
      !common.isStream(body)

    if (isJSON) {
      defaultHeaders.push('Content-Type', 'application/json')
    }
    common.forEachHeader(
      [...interceptor.rawHeaders, ...responseHeaders],
      (value, fieldName, i) => {
        rawHeaders.push([fieldName, value])
      },
    )

    rawHeaders.push(
      ...selectDefaultHeaders(
        [...interceptor.rawHeaders, ...responseHeaders],
        defaultHeaders,
      ),
    )

    for (let i = 0; i < rawHeaders.length; i++) {
      const [, value] = rawHeaders[i]

      // Evaluate functional headers.
      if (typeof value === 'function') {
        rawHeaders[i][1] = value(decompressedRequest, undefined, body)
      }
    }

    return new Headers(rawHeaders)
  }

  function continueWithResponseBody(
    rawBody,
    fullResponseStatus,
    fullResponseRawHeaders = [],
  ) {
    const headers = prepareResponseHeaders(rawBody, fullResponseRawHeaders)
    const bodyAsStream = convertBodyToStream(rawBody)
    bodyAsStream.pause()

    // TODO: there is probably a better way to support delay.
    // Wrap the stream in a duplex stream to support the delay.
    const readable = new stream.Duplex({
      read() {},
    })
    bodyAsStream.on('data', function (chunk) {
      readable.push(chunk)
    })
    bodyAsStream.on('end', function () {
      readable.push(null)
      interceptor.scope.emit('replied', decompressedRequest, interceptor)
    })
    bodyAsStream.on('error', function (err) {
      readable.emit('error', err)
    })

    common.setTimeout(() => bodyAsStream.resume(), interceptor.delayBodyInMs)

    const status = interceptor.statusCode || fullResponseStatus
    const hasBody = FetchResponse.isResponseWithBody(status)
    return new Response(hasBody ? readable : null, {
      status,
      statusText: STATUS_CODES[status],
      headers,
    })
  }
}

module.exports = { playbackInterceptor }
