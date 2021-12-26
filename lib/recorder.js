'use strict'

const debug = require('debug')('nock.recorder')
const querystring = require('querystring')
const { inspect } = require('util')

const common = require('./common')
const intercept = require('../modules/intercept-node-http')

const SEPARATOR = '\n<<<<<<-- cut here -->>>>>>\n'
let outputs = []

let resetIntercept

function getScope(options) {
  const { protocol, host, port } = common.normalizeRequestOptions(options)
  return common.normalizeOrigin(protocol, host, port)
}

function getMethod(options) {
  return options.method || 'GET'
}

function getBodyFromChunks(chunks, headers) {
  // If we have headers and there is content-encoding it means that the body
  // shouldn't be merged but instead persisted as an array of hex strings so
  // that the response chunks can be mocked one by one.
  if (headers && common.isContentEncoded(headers)) {
    return {
      body: chunks.map(chunk => chunk.toString('hex')),
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
    } catch (err) {
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

function generateRequestAndResponseObject({
  request,
  requestBodyChunks,
  options,
  response,
  responseDataChunks,
  requestHeaders,
}) {
  const { body, isUtf8Representable } = getBodyFromChunks(
    responseDataChunks,
    response.headers
  )
  options.path = request.path

  return {
    scope: getScope(options),
    method: getMethod(options),
    path: options.path,
    // Is it deliberate that `getBodyFromChunks()` is called a second time?
    body: getBodyFromChunks(requestBodyChunks).body,
    status: response.statusCode,
    response: body,
    rawHeaders: response.rawHeaders,
    reqheaders: requestHeaders || undefined,
    // When content-encoding is enabled, isUtf8Representable is `undefined`,
    // so we explicitly check for `false`.
    responseIsBinary: isUtf8Representable === false,
  }
}

function generateRequestAndResponse({
  request,
  requestBodyChunks,
  options,
  response,
  responseDataChunks,
  requestHeaders,
}) {
  const requestBody = getBodyFromChunks(requestBodyChunks).body
  const responseBody = getBodyFromChunks(
    responseDataChunks,
    response.headers
  ).body

  // Remove any query params from options.path so they can be added in the query() function
  let { path } = options
  const queryIndex = request.path.indexOf('?')
  let queryObj = {}
  if (queryIndex !== -1) {
    // Remove the query from the path
    path = path.substring(0, queryIndex)

    const queryStr = request.path.slice(queryIndex + 1)
    queryObj = querystring.parse(queryStr)
  }

  // Escape any single quotes in the path as the output uses them
  path = path.replace(/'/g, `\\'`)

  // Always encode the query parameters when recording.
  const encodedQueryObj = {}
  for (const key in queryObj) {
    const formattedPair = common.formatQueryValue(
      key,
      queryObj[key],
      common.percentEncode
    )
    encodedQueryObj[formattedPair[0]] = formattedPair[1]
  }

  const lines = []

  // We want a leading newline.
  lines.push('')

  const scope = getScope(options)
  lines.push(`nock('${scope}', {"encodedQueryParams":true})`)

  const methodName = getMethod(options).toLowerCase()
  if (requestBody) {
    lines.push(`  .${methodName}('${path}', ${JSON.stringify(requestBody)})`)
  } else {
    lines.push(`  .${methodName}('${path}')`)
  }

  Object.entries(requestHeaders || {}).forEach(([fieldName, fieldValue]) => {
    const safeName = JSON.stringify(fieldName)
    const safeValue = JSON.stringify(fieldValue)
    lines.push(`  .matchHeader(${safeName}, ${safeValue})`)
  })

  if (queryIndex !== -1) {
    lines.push(`  .query(${JSON.stringify(encodedQueryObj)})`)
  }

  const statusCode = response.statusCode.toString()
  const stringifiedResponseBody = JSON.stringify(responseBody)
  const headers = inspect(response.rawHeaders)
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
  logging: console.log, // eslint-disable-line no-console
  output_objects: false,
  use_separator: true,
}

function record(recOptions) {
  //  Trying to start recording with recording already in progress implies an error
  //  in the recording configuration (double recording makes no sense and used to lead
  //  to duplicates in output)
  if (resetIntercept) {
    throw new Error('Nock recording already in progress')
  }

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

  // turn off nock interception (backward compatibility behavior)
  require('./intercept').restore()

  //  We override the requests so that we can save information on them before executing.
  resetIntercept = intercept((options, overriddenRequest) => {
    const protocol = options.protocol.replace(':', '')

    debug(thisRecordingId, 'intercepting', protocol, 'request to record')
    const realRequest = overriddenRequest.nockSendRealRequest()

    realRequest.prependListener('response', response => {
      debug(thisRecordingId, protocol, 'intercepted request ended')

      let requestHeaders
      // Ignore request headers completely unless it was explicitly enabled by the user (see README)
      if (enableReqHeadersRecording) {
        // We never record user-agent headers as they are worse than useless -
        // they actually make testing more difficult without providing any benefit (see README)
        requestHeaders = realRequest.getHeaders()
        common.deleteHeadersField(requestHeaders, 'user-agent')
      }

      // We need to be aware of changes to the stream's encoding so that we
      // don't accidentally mangle the data.
      let encoding
      const origSetEncoding = response.setEncoding
      response.setEncoding = function (newEncoding) {
        encoding = newEncoding
        return origSetEncoding.apply(this, arguments)
      }

      const responseDataChunks = []
      const origResponsePush = response.push
      response.push = function (data) {
        if (data) {
          if (encoding) {
            data = Buffer.from(data, encoding)
          }
          responseDataChunks.push(data)
        }

        return origResponsePush.call(response, data)
      }

      response.on('end', () => {
        const generateFn = outputObjects
          ? generateRequestAndResponseObject
          : generateRequestAndResponse
        let out = generateFn({
          request: realRequest,
          requestBodyChunks: overriddenRequest.nockGetRequestBodyChunks(),
          options,
          response,
          responseDataChunks,
          requestHeaders,
        })

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

        outputs.push(out)

        if (!dontPrint) {
          if (useSeparator) {
            if (typeof out !== 'string') {
              out = JSON.stringify(out, null, 2)
            }
            logging(SEPARATOR + out + SEPARATOR)
          } else {
            logging(out)
          }
        }
      })
    })
  })
}

// Restore *all* the overridden http/https modules' properties.
function restore() {
  if (!resetIntercept) return

  debug(
    currentRecordingId,
    'restoring all the overridden http/https properties'
  )

  resetIntercept()
  resetIntercept = null
}

function clear() {
  outputs = []
}

module.exports = {
  record,
  outputs: () => outputs,
  restore,
  clear,
}
