'use strict'

const { inspect } = require('util')
const { parse: urlParse } = require('url')
const common = require('./common')
const intercept = require('./intercept')
const debug = require('debug')('nock.recorder')
const _ = require('lodash')
const URL = require('url')
const qs = require('qs')

const SEPARATOR = '\n<<<<<<-- cut here -->>>>>>\n'
let recordingInProgress = false
let outputs = []

function getScope(options) {
  common.normalizeRequestOptions(options)

  const scope = []
  if (options.proto === 'https') {
    scope.push('https://')
  } else {
    scope.push('http://')
  }

  scope.push(options.host)

  if (
    options.host.indexOf(':') === -1 &&
    options.port &&
    ((options.proto && options.port.toString() !== '443') ||
      (!options.proto && options.port.toString() !== '80'))
  ) {
    scope.push(':')
    scope.push(options.port)
  }

  return scope.join('')
}

function getMethod(options) {
  return options.method || 'GET'
}

const getBodyFromChunks = function(chunks, headers) {
  //  If we have headers and there is content-encoding it means that
  //  the body shouldn't be merged but instead persisted as an array
  //  of hex strings so that the responses can be mocked one by one.
  if (common.isContentEncoded(headers)) {
    return {
      body: _.map(chunks, chunk => chunk.toString('hex')),
    }
  }

  const mergedBuffer = Buffer.concat(chunks)

  //  The merged buffer can be one of three things:
  //    1.  A binary buffer which then has to be recorded as a hex string.
  //    2.  A string buffer which represents a JSON object.
  //    3.  A string buffer which doesn't represent a JSON object.

  const isBinary = common.isUtf8Representable(mergedBuffer)
  if (isBinary) {
    return {
      body: mergedBuffer.toString('hex'),
      isBinary: true,
    }
  } else {
    const maybeStringifiedJson = mergedBuffer.toString('utf8')
    try {
      return {
        body: JSON.parse(maybeStringifiedJson),
        isBinary: false,
      }
    } catch (err) {
      return {
        body: maybeStringifiedJson,
        isBinary: false,
      }
    }
  }
}

function generateRequestAndResponseObject(
  req,
  bodyChunks,
  options,
  res,
  dataChunks
) {
  const response = getBodyFromChunks(dataChunks, res.headers)
  options.path = req.path

  const nockDef = {
    scope: getScope(options),
    method: getMethod(options),
    path: options.path,
    body: getBodyFromChunks(bodyChunks).body,
    status: res.statusCode,
    response: response.body,
    rawHeaders: res.rawHeaders || res.headers,
    reqheaders: req._headers,
  }

  if (response.isBinary) {
    nockDef.responseIsBinary = true
  }

  return nockDef
}

function generateRequestAndResponse(req, bodyChunks, options, res, dataChunks) {
  const requestBody = getBodyFromChunks(bodyChunks).body
  const responseBody = getBodyFromChunks(dataChunks, res.headers).body

  // Remove any query params from options.path so they can be added in the query() function
  let { path } = options
  let queryIndex = 0
  let queryObj = {}
  if ((queryIndex = req.path.indexOf('?')) !== -1) {
    // Remove the query from the path
    path = path.substring(0, queryIndex)

    // Create the query() object
    const queryStr = req.path.slice(queryIndex + 1)
    queryObj = qs.parse(queryStr)
  }
  // Always encoding the query parameters when recording.
  const encodedQueryObj = {}
  for (const key in queryObj) {
    const formattedPair = common.formatQueryValue(
      key,
      queryObj[key],
      common.percentEncode
    )
    encodedQueryObj[formattedPair[0]] = formattedPair[1]
  }

  const ret = []
  ret.push("\nnock('")
  ret.push(getScope(options))
  ret.push("', ")
  ret.push(JSON.stringify({ encodedQueryParams: true }))
  ret.push(')\n')
  ret.push('  .')
  ret.push(getMethod(options).toLowerCase())
  ret.push("('")
  ret.push(path)
  ret.push("'")
  if (requestBody) {
    ret.push(', ')
    ret.push(JSON.stringify(requestBody))
  }
  ret.push(')\n')
  // TODO-coverage: Try to add coverage of this case.
  if (req.headers) {
    for (const k in req.headers) {
      ret.push(
        `  .matchHeader(${JSON.stringify(k)}, ${JSON.stringify(
          req.headers[k]
        )})\n`
      )
    }
  }

  if (queryIndex !== -1) {
    ret.push('  .query(')
    ret.push(JSON.stringify(encodedQueryObj))
    ret.push(')\n')
  }

  ret.push('  .reply(')
  ret.push(res.statusCode.toString())
  ret.push(', ')
  ret.push(JSON.stringify(responseBody))
  if (res.rawHeaders) {
    ret.push(', ')
    ret.push(inspect(res.rawHeaders))
  } else if (res.headers) {
    // TODO-coverage: Try to add coverage of this case.
    ret.push(', ')
    ret.push(inspect(res.headers))
  }
  ret.push(');\n')

  return ret.join('')
}

//  This module variable is used to identify a unique recording ID in order to skip
//  spurious requests that sometimes happen. This problem has been, so far,
//  exclusively detected in nock's unit testing where 'checks if callback is specified'
//  interferes with other tests as its t.end() is invoked without waiting for request
//  to finish (which is the point of the test).
let currentRecordingId = 0

function record(recOptions) {
  //  Set the new current recording ID and capture its value in this instance of record().
  currentRecordingId = currentRecordingId + 1
  const thisRecordingId = currentRecordingId

  debug('start recording', thisRecordingId, JSON.stringify(recOptions))

  //  Trying to start recording with recording already in progress implies an error
  //  in the recording configuration (double recording makes no sense and used to lead
  //  to duplicates in output)
  if (recordingInProgress) {
    throw new Error('Nock recording already in progress')
  }

  recordingInProgress = true

  //  Originally the parameters was a dont_print boolean flag.
  //  To keep the existing code compatible we take that case into account.
  const optionsIsObject = typeof recOptions === 'object'
  const dontPrint =
    (typeof recOptions === 'boolean' && recOptions) ||
    (optionsIsObject && recOptions.dont_print)
  const outputObjects = optionsIsObject && recOptions.output_objects
  const enableReqHeadersRecording =
    optionsIsObject && recOptions.enable_reqheaders_recording
  // eslint-disable-next-line no-console
  const logging = (optionsIsObject && recOptions.logging) || console.log
  let useSeparator = true
  if (optionsIsObject && _.has(recOptions, 'use_separator')) {
    useSeparator = recOptions.use_separator
  }

  debug(thisRecordingId, 'restoring overridden requests before new overrides')
  //  To preserve backward compatibility (starting recording wasn't throwing if nock was already active)
  //  we restore any requests that may have been overridden by other parts of nock (e.g. intercept)
  //  NOTE: This is hacky as hell but it keeps the backward compatibility *and* allows correct
  //    behavior in the face of other modules also overriding ClientRequest.
  common.restoreOverriddenRequests()
  //  We restore ClientRequest as it messes with recording of modules that also override ClientRequest (e.g. xhr2)
  intercept.restoreOverriddenClientRequest()

  //  We override the requests so that we can save information on them before executing.
  common.overrideRequests(function(
    proto,
    overriddenRequest,
    options,
    callback
  ) {
    const bodyChunks = []

    if (typeof options === 'string') {
      // TODO-coverage: Investigate why this was added. Add a test if
      // possible. If we can't figure it out, remove it.
      const url = URL.parse(options)
      options = {
        hostname: url.hostname,
        method: 'GET',
        port: url.port,
        path: url.path,
      }
    }

    // Node 0.11 https.request calls http.request -- don't want to record things
    // twice.
    if (options._recording) {
      return overriddenRequest(options, callback)
    }
    options._recording = true

    const req = overriddenRequest(options, function(res) {
      debug(thisRecordingId, 'intercepting', proto, 'request to record')

      // TODO-coverage: Investigate why this was added. Add a test if
      // possible. If we can't figure it out, remove it.
      if (typeof options === 'string') {
        options = urlParse(options)
      }

      //  We put our 'end' listener to the front of the listener array.
      res.once('end', function() {
        debug(thisRecordingId, proto, 'intercepted request ended')

        let out
        if (outputObjects) {
          out = generateRequestAndResponseObject(
            req,
            bodyChunks,
            options,
            res,
            dataChunks
          )
          // TODO-coverage: The `else` case is missing coverage. Maybe look
          // into the enable_reqheaders_recording option.
          if (out.reqheaders) {
            //  We never record user-agent headers as they are worse than useless -
            //  they actually make testing more difficult without providing any benefit (see README)
            common.deleteHeadersField(out.reqheaders, 'user-agent')

            //  Remove request headers completely unless it was explicitly enabled by the user (see README)
            if (!enableReqHeadersRecording) {
              delete out.reqheaders
            }
          }
        } else {
          out = generateRequestAndResponse(
            req,
            bodyChunks,
            options,
            res,
            dataChunks
          )
        }

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
              // TODO-coverage: This is missing coverage. Could this be
              // connected to the `output_object` option?
              out = JSON.stringify(out, null, 2)
            }
            logging(SEPARATOR + out + SEPARATOR)
          } else {
            logging(out)
          }
        }
      })

      const dataChunks = []
      let encoding

      // We need to be aware of changes to the stream's encoding so that we
      // don't accidentally mangle the data.
      const { setEncoding } = res
      res.setEncoding = function(newEncoding) {
        encoding = newEncoding
        return setEncoding.apply(this, arguments)
      }

      // Replace res.push with our own implementation that stores chunks
      const origResPush = res.push
      res.push = function(data) {
        if (data) {
          if (encoding) {
            data = Buffer.from(data, encoding)
          }
          dataChunks.push(data)
        }

        return origResPush.call(res, data)
      }

      if (callback) {
        callback(res, options, callback)
      } else {
        res.resume()
      }

      debug('finished setting up intercepting')

      // We override both the http and the https modules; when we are
      // serializing the request, we need to know which was called.
      // By stuffing the state, we can make sure that nock records
      // the intended protocol.
      if (proto === 'https') {
        options.proto = 'https'
      }
    })

    const oldWrite = req.write
    req.write = function(data, encoding) {
      if (typeof data !== 'undefined') {
        debug(thisRecordingId, 'new', proto, 'body chunk')
        if (!Buffer.isBuffer(data)) {
          data = Buffer.from(data, encoding)
        }
        bodyChunks.push(data)
        oldWrite.apply(req, arguments)
      } else {
        throw new Error('Data was undefined.')
      }
    }

    // Starting in Node 8, `res.end()` does not call `res.write()` directly.
    // TODO: This is `req.end()`; is that a typo? ^^
    const oldEnd = req.end
    req.end = function(data, encoding, callback) {
      // TODO Shuffle the arguments for parity with the real `req.end()`.
      // https://github.com/nock/nock/issues/1549
      if (_.isFunction(data) && arguments.length === 1) {
        callback = data
        data = null
      }
      if (data) {
        debug(thisRecordingId, 'new', proto, 'body chunk')
        if (!Buffer.isBuffer(data)) {
          // TODO-coverage: Add a test.
          data = Buffer.from(data, encoding)
        }
        bodyChunks.push(data)
      }
      oldEnd.apply(req, arguments)
    }

    return req
  })
}

//  Restores *all* the overridden http/https modules' properties.
function restore() {
  debug(
    currentRecordingId,
    'restoring all the overridden http/https properties'
  )

  common.restoreOverriddenRequests()
  intercept.restoreOverriddenClientRequest()
  recordingInProgress = false
}

function clear() {
  outputs = []
}

exports.record = record
exports.outputs = function() {
  return outputs
}
exports.restore = restore
exports.clear = clear
