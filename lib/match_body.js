'use strict'

const deepEqual = require('deep-equal')
const qs = require('qs')
const _ = require('lodash')
const common = require('./common')



module.exports = function matchBody(options, spec, body) {
  if (spec instanceof RegExp) {
    return spec.test(body)
  }

  if (Buffer.isBuffer(spec)) {
    if (common.isUtf8Representable(spec)) {
      spec = spec.toString('hex')
    } else {
      spec = spec.toString('utf8')
    }
  }

  const contentType = (
    (options.headers &&
      (options.headers['Content-Type'] || options.headers['content-type'])) ||
    ''
  ).toString()

  const isMultipart = contentType.indexOf('multipart') >= 0
  const isUrlencoded =
    contentType.indexOf('application/x-www-form-urlencoded') >= 0

  // try to transform body to json
  let json
  if (typeof spec === 'object' || typeof spec === 'function') {
    try {
      json = JSON.parse(body)
    } catch (err) {
      // not a valid JSON string
    }
    if (json !== undefined) {
      body = json
    } else if (isUrlencoded) {
      body = qs.parse(body, { allowDots: true })
    }
  }

  if (typeof spec === 'function') {
    return spec.call(options, body)
  }

  // strip line endings from both so that we get a match no matter what OS we are running on
  // if Content-Type does not contains 'multipart'
  if (!isMultipart && typeof body === 'string') {
    body = body.replace(/\r?\n|\r/g, '')
  }

  if (!isMultipart && typeof spec === 'string') {
    spec = spec.replace(/\r?\n|\r/g, '')
  }

  if (isUrlencoded) {
    spec = mapValuesDeep(spec, function(val) {
      if (_.isRegExp(val)) {
        return val
      }
      return `${val}`
    })
  }

  return deepEqualExtended(spec, body)
}

/**
 * Based on lodash issue discussion
 * https://github.com/lodash/lodash/issues/1244
 */
function mapValuesDeep(obj, cb) {
  if (_.isArray(obj)) {
    return obj.map(function(v) {
      return mapValuesDeep(v, cb)
    })
  }
  if (_.isPlainObject(obj)) {
    return _.mapValues(obj, function(v) {
      return mapValuesDeep(v, cb)
    })
  }
  return cb(obj)
}

function deepEqualExtended(spec, body) {
  if (spec && spec.constructor === RegExp) {
    return spec.test(body)
  }
  if (
    spec &&
    (spec.constructor === Object || spec.constructor === Array) &&
    body
  ) {
    const keys = Object.keys(spec)
    const bodyKeys = Object.keys(body)
    if (keys.length !== bodyKeys.length) {
      return false
    }
    for (let i = 0; i < keys.length; i++) {
      if (!deepEqualExtended(spec[keys[i]], body[keys[i]])) {
        return false
      }
    }
    return true
  }
  return deepEqual(spec, body, { strict: true })
}
