// @ts-check

module.exports = {
  headersFieldNamesToLowerCase,
  isRequestDestroyed,
  isUtf8Representable,
}

/**
 * Return a new object with all field names of the headers lower-cased.
 *
 * Duplicates throw an error.
 */
function headersFieldNamesToLowerCase(headers) {
  if (!isPlainObject(headers)) {
    throw Error('Headers must be provided as an object')
  }

  const lowerCaseHeaders = {}
  Object.entries(headers).forEach(([fieldName, fieldValue]) => {
    // if header is set multiple times (case insestitive), match the last key
    const key = fieldName.toLowerCase()
    lowerCaseHeaders[key] = fieldValue
  })

  return lowerCaseHeaders
}

/**
 * Check if the Client Request has been cancelled.
 *
 * Until Node 14 is the minimum, we need to look at both flags to see if the request has been cancelled.
 * The two flags have the same purpose, but the Node maintainers are migrating from `abort(ed)` to
 * `destroy(ed)` terminology, to be more consistent with `stream.Writable`.
 * In Node 14.x+, Calling `abort()` will set both `aborted` and `destroyed` to true, however,
 * calling `destroy()` will only set `destroyed` to true.
 * Falling back on checking if the socket is destroyed to cover the case of Node <14.x where
 * `destroy()` is called, but `destroyed` is undefined.
 *
 * Node Client Request history:
 * - `request.abort()`: Added in: v0.3.8, Deprecated since: v14.1.0, v13.14.0
 * - `request.aborted`: Added in: v0.11.14, Became a boolean instead of a timestamp: v11.0.0, Not deprecated (yet)
 * - `request.destroy()`: Added in: v0.3.0
 * - `request.destroyed`: Added in: v14.1.0, v13.14.0
 *
 * @param {import("http").ClientRequest} req
 * @returns {boolean}
 */
function isRequestDestroyed(req) {
  return !!(
    req.destroyed === true ||
    req.aborted ||
    (req.socket && req.socket.destroyed)
  )
}

/**
 * Returns true if the data contained in buffer can be reconstructed
 * from its utf8 representation.
 *
 * @param  {Object} buffer - a Buffer object
 * @returns {boolean}
 */
function isUtf8Representable(buffer) {
  const utfEncodedBuffer = buffer.toString('utf8')
  const reconstructedBuffer = Buffer.from(utfEncodedBuffer, 'utf8')
  return reconstructedBuffer.equals(buffer)
}

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 * https://github.com/lodash/lodash/blob/588bf3e20db0ae039a822a14a8fa238c5b298e65/isPlainObject.js
 *
 * @param {*} value The value to check.
 * @return {boolean}
 */
function isPlainObject(value) {
  const isObjectLike = typeof value === 'object' && value !== null
  const tag = Object.prototype.toString.call(value)
  if (!isObjectLike || tag !== '[object Object]') {
    return false
  }
  if (Object.getPrototypeOf(value) === null) {
    return true
  }
  let prototype = value
  while (Object.getPrototypeOf(prototype) !== null) {
    prototype = Object.getPrototypeOf(prototype)
  }
  return Object.getPrototypeOf(value) === prototype
}
