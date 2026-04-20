import type { Interceptor } from './interceptor.ts'
import { STATUS_CODES } from 'node:http'
import stream from 'node:stream'
import util from 'node:util'
import { playback_interceptor as debug } from './debug.ts'
import * as common from './common.ts'
import { FetchResponse } from '@mswjs/interceptors'

function parseFullReplyResult(fullReplyResult: any[]) {
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

function selectDefaultHeaders(existingHeaders: any[], defaultHeaders: any[]) {
  if (!defaultHeaders.length) {
    return [] // return early if we don't need to bother
  }

  const definedHeaders = new Set()
  const result: [string, any][] = []

  common.forEachHeader(existingHeaders, (_: any, fieldName: string) => {
    definedHeaders.add(fieldName.toLowerCase())
  })
  common.forEachHeader(defaultHeaders, (value: any, fieldName: string) => {
    if (!definedHeaders.has(fieldName.toLowerCase())) {
      result.push([fieldName, value])
    }
  })

  return result
}

// Presents a list of Buffers as a Readable
class ReadableBuffers extends stream.Readable {
  declare buffers: Buffer[]

  constructor(buffers: Buffer[]) {
    super()

    this.buffers = buffers
  }

  _read() {
    while (this.buffers.length) {
      if (!this.push(this.buffers.shift())) {
        return
      }
    }
    this.push(null)
  }
}

function convertBodyToStream(body: any) {
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

async function playbackInterceptor({
  decompressedRequest,
  interceptor,
  requestBodyString,
  requestBodyIsUtf8Representable,
}: {
  decompressedRequest: Request
  requestBodyString: string
  requestBodyIsUtf8Representable: boolean
  interceptor: Interceptor
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

  logger('response.rawHeaders:', interceptor.rawHeaders)

  // .reply(status, replyFunction)
  if (interceptor.replyFunction) {
    let fn = interceptor.replyFunction
    if (fn.length === 2) {
      // Handle the case of an async reply function, the third parameter being the callback.
      fn = util.promisify(fn) as any
    }

    // At this point `fn` is either a synchronous function or a promise-returning function;
    // wrapping in `Promise.resolve` makes it into a promise either way.
    return Promise.resolve((fn as any).call(interceptor, decompressedRequest))
      .then(continueWithResponseBody)
      .catch((err: any) => {
        throw err
      })
  }
  // .reply(fullReplyFunction)
  else if (interceptor.fullReplyFunction) {
    let fn = interceptor.fullReplyFunction
    if (fn.length === 2) {
      fn = util.promisify(fn) as any
    }

    return Promise.resolve((fn as any).call(interceptor, decompressedRequest))
      .then(continueWithFullResponse)
      .catch((err: any) => {
        throw err
      })
  }

  if (
    common.isContentEncoded(interceptor.headers || {}) &&
    !common.isStream(interceptor.body)
  ) {
    //  If the content is encoded we know that the response body *must* be an array
    //  of response buffers which should be mocked one by one.
    const bufferData = Array.isArray(interceptor.body)
      ? interceptor.body
      : [interceptor.body]
    const responseBuffers = bufferData.map((data: string) => Buffer.from(data, 'hex'))
    const responseBody = new ReadableBuffers(responseBuffers)
    return continueWithResponseBody(responseBody)
  }

  // If we get to this point, the body is either a string or an object that
  // will eventually be JSON stringified.
  let responseBody: any = interceptor.body

  // If the request was not UTF8-representable then we assume that the
  // response won't be either. In that case we send the response as a Buffer
  // object as that's what the client will expect.
  if (!requestBodyIsUtf8Representable && typeof responseBody === 'string') {
    // Try to create the buffer from the interceptor's body response as hex.
    responseBody = Buffer.from(responseBody, 'hex')

    // Creating buffers does not necessarily throw errors; check for difference in size.
    if (
      !responseBody ||
      ((interceptor.body as string).length > 0 && responseBody.length === 0)
    ) {
      // We fallback on constructing buffer from utf8 representation of the body.
      responseBody = Buffer.from(interceptor.body as string, 'utf8')
    }
  }

  return continueWithResponseBody(responseBody)

  function continueWithFullResponse(fullReplyResult: [number, any, any[]]) {
    const [status, responseBody, rawHeaders] =
      parseFullReplyResult(fullReplyResult)
    return continueWithResponseBody(responseBody, status, rawHeaders)
  }

  async function prepareResponseHeaders(body: any, responseHeaders: any[]) {
    const defaultHeaders = [...interceptor.scope._defaultReplyHeaders]
    const rawHeaders: [string, any][] = []

    // Include a JSON content type when JSON.stringify is called on the body.
    const isJSON =
      body !== undefined &&
      typeof body !== 'string' &&
      !Buffer.isBuffer(body) &&
      !common.isStream(body)

    if (isJSON) {
      defaultHeaders.push('Content-Type', 'application/json')
    }
    common.forEachHeader(
      [...(interceptor.rawHeaders || []), ...responseHeaders],
      (value: any, fieldName: string) => {
        rawHeaders.push([fieldName, value])
      },
    )

    rawHeaders.push(
      ...selectDefaultHeaders(
        [...(interceptor.rawHeaders || []), ...responseHeaders],
        defaultHeaders,
      ),
    )

    for (let i = 0; i < rawHeaders.length; i++) {
      const [, value] = rawHeaders[i]

      // Evaluate functional headers.
      if (typeof value === 'function') {
        rawHeaders[i][1] = await value(decompressedRequest, body)
      }
    }

    return new Headers(rawHeaders)
  }

  async function continueWithResponseBody(
    rawBody: any,
    fullResponseStatus?: number,
    fullResponseRawHeaders: any[] = [],
  ) {
    const headers = await prepareResponseHeaders(
      rawBody,
      fullResponseRawHeaders,
    )
    const bodyAsStream = convertBodyToStream(rawBody)
    bodyAsStream.resume()

    // TODO: there is probably a better way to support delay.
    // Wrap the stream in a duplex stream to support the delay.
    const readable = new stream.Readable({
      read() {},
    })
    bodyAsStream.on('data', function (chunk: Buffer) {
      readable.push(chunk)
    })
    bodyAsStream.on('end', function () {
      common.setTimeout(() => {
        readable.push(null)
        interceptor.scope.emit('replied', decompressedRequest, interceptor)
      }, interceptor.delayBodyInMs)
    })
    bodyAsStream.on('error', function (err: Error) {
      readable.emit('error', err)
    })

    const status = interceptor.statusCode || fullResponseStatus
    const hasBody = FetchResponse.isResponseWithBody(status as number)
    return new Response(hasBody ? readable : null, {
      status: status as number,
      statusText: STATUS_CODES[status as number],
      headers,
    })
  }
}

export { playbackInterceptor }
