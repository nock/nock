import type { Definition } from './scope.ts'

export interface RecorderOptions {
  dont_print?: boolean
  output_objects?: boolean
  enable_reqheaders_recording?: boolean
  logging?: (content: string) => void
  use_separator?: boolean
}

import { recorder as debug } from './debug.ts'
import querystring from 'node:querystring'
import { inspect } from 'node:util'

import * as common from './common.ts'
import { restoreOverriddenClientRequest } from './intercept.ts'
import { gzipSync, brotliCompressSync, deflateSync } from 'node:zlib'
import nodeInterceptors from '@mswjs/interceptors/presets/node'
const SEPARATOR = '\n<<<<<<-- cut here -->>>>>>\n'
let recordingInProgress = false
let _outputs: Array<string | Definition> = []

// TODO: don't reuse the nodeInterceptors, create new ones.
const clientRequestInterceptor = nodeInterceptors[0]
const fetchRequestInterceptor = nodeInterceptors[2]

function getScope(url: URL) {
  return common.normalizeOrigin(url)
}

function getMethod(request: Request) {
  return request.method || 'GET'
}

function getBodyFromChunks(chunks: Buffer[], headers?: Record<string, any>) {
  // If we have headers and there is content-encoding it means that the body
  // shouldn't be merged but instead persisted as an array of hex strings so
  // that the response chunks can be mocked one by one.
  if (headers && common.isContentEncoded(headers)) {
    return {
      body: chunks.map((chunk: Buffer) => chunk.toString('hex')),
    }
  }

  const mergedBuffer = Buffer.concat(chunks)

  // The merged buffer can be one of three things:
  // 1. A UTF-8-representable string buffer which represents a JSON object.
  // 2. A UTF-8-representable buffer which doesn't represent a JSON object.
  // 3. A non-UTF-8-representable buffer which then has to be recorded as a hex string.
  const isUtf8Representable = common.isUtf8Representable(mergedBuffer)
  if (isUtf8Representable) {
    const maybeStringifiedJson = mergedBuffer.toString('utf8')
    try {
      return {
        isUtf8Representable,
        body: JSON.parse(maybeStringifiedJson),
      }
    } catch {
      return {
        isUtf8Representable,
        body: maybeStringifiedJson,
      }
    }
  } else {
    return {
      isUtf8Representable,
      body: mergedBuffer.toString('hex'),
    }
  }
}

async function generateRequestAndResponseObject(request: Request, response: Response) {
  const { body, isUtf8Representable } = getBodyFromChunks(
    [Buffer.from(await response.arrayBuffer())],
    Object.fromEntries(response.headers.entries()),
  )
  const url = new URL(request.url)
  const reqheaders = Object.fromEntries(request.headers.entries())
  return {
    scope: getScope(url),
    method: getMethod(request),
    path: url.pathname + url.search,
    // Is it deliberate that `getBodyFromChunks()` is called a second time?
    body: getBodyFromChunks([Buffer.from(await request.arrayBuffer())]).body,
    status: response.status,
    response: body,
    rawHeaders: Object.fromEntries(response.headers.entries()),
    reqheaders: Object.keys(reqheaders).length > 0 ? reqheaders : undefined,
    // When content-encoding is enabled, isUtf8Representable is `undefined`,
    // so we explicitly check for `false`.
    responseIsBinary: isUtf8Representable === false,
  }
}

async function generateRequestAndResponse(request: Request, response: Response) {
  const url = new URL(request.url)
  const requestBody = getBodyFromChunks([
    Buffer.from(await request.arrayBuffer()),
  ]).body
  const responseBody = getBodyFromChunks(
    [Buffer.from(await response.arrayBuffer())],
    response.headers as any,
  ).body

  const encodedQueryObj: Record<string, any> = {}

  for (const [key, value] of Object.entries(
    querystring.parse(url.searchParams.toString()),
  )) {
    const formattedPair = common.formatQueryValue(
      key,
      value,
      common.percentEncode,
    )
    encodedQueryObj[formattedPair[0]] = formattedPair[1]
  }

  const lines: string[] = []

  // We want a leading newline.
  lines.push('')

  const scope = getScope(url)
  lines.push(`nock('${scope}', {"encodedQueryParams":true})`)

  const methodName = getMethod(request).toLowerCase()
  // Escape any single quotes in the path as the output uses them
  const escapedPath = url.pathname.replace(/'/g, `\\'`)
  if (requestBody) {
    lines.push(
      `  .${methodName}('${escapedPath}', ${JSON.stringify(requestBody)})`,
    )
  } else {
    lines.push(`  .${methodName}('${escapedPath}')`)
  }

  request.headers.forEach((value, name) => {
    const safeName = JSON.stringify(name)
    const safeValue = JSON.stringify(value)
    lines.push(`  .matchHeader(${safeName}, ${safeValue})`)
  })

  if (Object.keys(encodedQueryObj).length > 0) {
    lines.push(`  .query(${JSON.stringify(encodedQueryObj)})`)
  }

  const statusCode = String(response.status)
  const stringifiedResponseBody = JSON.stringify(responseBody)
  const headers = inspect(Object.fromEntries(response.headers.entries()))
  lines.push(`  .reply(${statusCode}, ${stringifiedResponseBody}, ${headers});`)

  return lines.join('\n')
}

//  This module variable is used to identify a unique recording ID in order to skip
//  spurious requests that sometimes happen. This problem has been, so far,
//  exclusively detected in nock's unit testing where 'checks if callback is specified'
//  interferes with other tests as its t.end() is invoked without waiting for request
//  to finish (which is the point of the test).
let currentRecordingId = 0

const defaultRecordOptions = {
  dont_print: false,
  enable_reqheaders_recording: false,
  logging: console.log,
  output_objects: false,
  use_separator: true,
}

function record(recOptions?: boolean | RecorderOptions) {
  //  Trying to start recording with recording already in progress implies an error
  //  in the recording configuration (double recording makes no sense and used to lead
  //  to duplicates in output)
  if (recordingInProgress) {
    throw new Error('Nock recording already in progress')
  }

  recordingInProgress = true

  // Set the new current recording ID and capture its value in this instance of record().
  currentRecordingId = currentRecordingId + 1
  const thisRecordingId = currentRecordingId

  // Originally the parameter was a dont_print boolean flag.
  // To keep the existing code compatible we take that case into account.
  if (typeof recOptions === 'boolean') {
    recOptions = { dont_print: recOptions }
  }

  recOptions = { ...defaultRecordOptions, ...recOptions }

  debug('start recording', thisRecordingId, recOptions)

  const {
    dont_print: dontPrint,
    enable_reqheaders_recording: enableReqHeadersRecording,
    logging,
    output_objects: outputObjects,
    use_separator: useSeparator,
  } = recOptions

  debug(String(thisRecordingId), 'restoring overridden requests before new overrides')
  //  To preserve backward compatibility (starting recording wasn't throwing if nock was already active)
  //  we restore any requests that may have been overridden by other parts of nock (e.g. intercept)
  //  NOTE: This is hacky as hell but it keeps the backward compatibility *and* allows correct
  //    behavior in the face of other modules also overriding ClientRequest.
  // common.restoreOverriddenRequests()
  //  We restore ClientRequest as it messes with recording of modules that also override ClientRequest (e.g. xhr2)
  restoreOverriddenClientRequest()

  //  We override the requests so that we can save information on them before executing.
  clientRequestInterceptor.apply()
  fetchRequestInterceptor.apply()
  clientRequestInterceptor.on(
    'response',
    async function ({ request, response }: any) {
      await recordResponse(request, response)
    },
  )
  fetchRequestInterceptor.on(
    'response',
    async function ({ request, response }: any) {
      // fetch decompresses the body automatically, so we need to recompress it
      const codings =
        response.headers
          .get('content-encoding')
          ?.toLowerCase()
          .split(',')
          .map((c: string) => c.trim()) || []

      let body: ArrayBuffer = await response.arrayBuffer()
      for (const coding of codings) {
        if (coding === 'gzip') {
          body = gzipSync(body) as any
        } else if (coding === 'deflate') {
          body = deflateSync(body) as any
        } else if (coding === 'br') {
          body = brotliCompressSync(body) as any
        }
      }

      await recordResponse(request, new Response(body, response))
    },
  )

  async function recordResponse(mswRequest: Request, mswResponse: Response) {
    const request = mswRequest.clone()
    const response = mswResponse.clone()
    debug(
      String(thisRecordingId),
      request.url.split(':', 1)[0],
      'intercepted request ended',
    )

    // Ignore request headers completely unless it was explicitly enabled by the user (see README)
    if (enableReqHeadersRecording) {
      // We never record user-agent headers as they are worse than useless -
      // they actually make testing more difficult without providing any benefit (see README)
      request.headers.delete('user-agent')
    } else {
      // TODO: request.headers.forEach skip a header, need to investigate it.
      const keys = Array.from(request.headers.keys())
      for (const header of keys) {
        request.headers.delete(header)
      }
    }

    const generateFn = outputObjects
      ? generateRequestAndResponseObject
      : generateRequestAndResponse
    let out: any = await generateFn(request, response)

    debug('out:', out)

    //  Check that the request was made during the current recording.
    //  If it hasn't then skip it. There is no other simple way to handle
    //  this as it depends on the timing of requests and responses. Throwing
    //  will make some recordings/unit tests fail randomly depending on how
    //  fast/slow the response arrived.
    //  If you are seeing this error then you need to make sure that all
    //  the requests made during a single recording session finish before
    //  ending the same recording session.
    if (thisRecordingId !== currentRecordingId) {
      debug('skipping recording of an out-of-order request', out)
      return
    }

    _outputs.push(out)

    if (!dontPrint) {
      if (useSeparator) {
        if (typeof out !== 'string') {
          out = JSON.stringify(out, null, 2)
        }
        ;(logging as Function)(SEPARATOR + out + SEPARATOR)
      } else {
        ;(logging as Function)(out)
      }
    }

    debug('finished setting up intercepting')
  }
}

// Restore *all* the overridden http/https modules' properties.
function restore() {
  debug(
    String(currentRecordingId),
    'restoring all the overridden http/https properties',
  )

  clientRequestInterceptor.dispose()
  fetchRequestInterceptor.dispose()
  restoreOverriddenClientRequest()
  recordingInProgress = false
}

function clear() {
  _outputs = []
}

function outputs(): string[] | Definition[] {
  return _outputs as string[] | Definition[]
}

export {
  record,
  outputs,
  restore,
  clear,
}
