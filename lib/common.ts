import { common as debug } from './debug.ts'
import timers from 'node:timers'
import util from 'node:util'
import zlib from 'node:zlib'

function normalizeRequestOptions(options: Record<string, any>) {
  options.proto = options.proto || 'http'
  options.port = options.port || (options.proto === 'http' ? 80 : 443)
  if (options.host) {
    debug('options.host:', options.host)
    if (!options.hostname) {
      if (options.host.split(':').length === 2) {
        options.hostname = options.host.split(':')[0]
      } else {
        options.hostname = options.host
      }
    }
  }
  debug('options.hostname in the end: %j', options.hostname)
  options.host = `${options.hostname || 'localhost'}:${options.port}`
  debug('options.host in the end: %j', options.host)

  /// lowercase host names
  ;['hostname', 'host'].forEach(function (attr) {
    if (options[attr]) {
      options[attr] = options[attr].toLowerCase()
    }
  })

  return options
}

function isUtf8Representable(buffer: ArrayBuffer | Buffer) {
  try {
    new TextDecoder('utf8', { fatal: true }).decode(buffer)
    return true
  } catch {
    return false
  }
}

function normalizeOrigin(url: URL) {
  // Remove brackets from hostname if IPV6
  const normalizedOrigin = url.hostname.startsWith('[')
    ? `${url.protocol}//${url.hostname.slice(1, -1)}${url.port ? `:${url.port}` : ''}`
    : url.origin
  if (url.port) {
    return normalizedOrigin
  } else {
    return normalizedOrigin + (url.protocol === 'http:' ? ':80' : ':443')
  }
}

function stringifyRequest(request: Request, body: string) {
  const url = new URL(request.url)

  const log: Record<string, any> = {
    method: request.method,
    url: `${url.origin}${url.pathname}`,
    headers: Object.fromEntries(request.headers.entries()),
  }

  if (body) {
    log.body = body
  }

  return JSON.stringify(log, null, 2)
}

function isContentEncoded(headers: Record<string, any>) {
  const contentEncoding = headers['content-encoding']
  return typeof contentEncoding === 'string' && contentEncoding !== ''
}

function contentEncoding(headers: Headers, encoder: 'gzip' | 'deflate') {
  const contentEncoding = headers.get('content-encoding')
  return contentEncoding?.toString() === encoder
}

function isJSONContent(headers: Headers) {
  // https://tools.ietf.org/html/rfc8259
  const contentType = String(headers.get('content-type') || '').toLowerCase()
  return contentType.startsWith('application/json')
}

function headersFieldNamesToLowerCase(headers: Record<string, any>, throwOnDuplicate?: boolean) {
  if (!isPlainObject(headers)) {
    throw Error('Headers must be provided as an object')
  }

  const lowerCaseHeaders: Record<string, any> = {}
  Object.entries(headers).forEach(([fieldName, fieldValue]) => {
    const key = fieldName.toLowerCase()
    if (lowerCaseHeaders[key] !== undefined) {
      if (throwOnDuplicate) {
        throw Error(
          `Failed to convert header keys to lower case due to field name conflict: ${key}`,
        )
      } else {
        debug(
          `Duplicate header provided in request: ${key}. Only the last value can be matched.`,
        )
      }
    }
    lowerCaseHeaders[key] = fieldValue
  })

  return lowerCaseHeaders
}

const headersFieldsArrayToLowerCase = (headers: string[]) => [
  ...new Set(headers.map(fieldName => fieldName.toLowerCase())),
]

function headersInputToRawArray(headers?: any[] | Map<string, any> | Record<string, any>) {
  if (headers === undefined) {
    return []
  }

  if (Array.isArray(headers)) {
    // If the input is an array, assume it's already in the raw format and simply return a copy
    // but throw an error if there aren't an even number of items in the array
    if (headers.length % 2) {
      throw new Error(
        `Raw headers must be provided as an array with an even number of items. [fieldName, value, ...]`,
      )
    }
    return [...headers]
  }

  // [].concat(...) is used instead of Array.flat until v11 is the minimum Node version
  if (util.types.isMap(headers)) {
    return ([] as any[]).concat(
      ...Array.from(headers as Map<string, any>, ([k, v]) => [k.toString(), v]),
    )
  }

  if (isPlainObject(headers)) {
    return ([] as any[]).concat(...Object.entries(headers))
  }

  throw new Error(
    `Headers must be provided as an array of raw values, a Map, or a plain Object. ${headers}`,
  )
}

function headersArrayToObject(rawHeaders: any[]) {
  if (!Array.isArray(rawHeaders)) {
    throw Error('Expected a header array')
  }

  const accumulator: Record<string, any> = {}

  forEachHeader(rawHeaders, (value, fieldName) => {
    addHeaderLine(accumulator, fieldName, value)
  })

  return accumulator
}

const noDuplicatesHeaders = new Set([
  'age',
  'authorization',
  'content-length',
  'content-type',
  'etag',
  'expires',
  'from',
  'host',
  'if-modified-since',
  'if-unmodified-since',
  'last-modified',
  'location',
  'max-forwards',
  'proxy-authorization',
  'referer',
  'retry-after',
  'user-agent',
])

function addHeaderLine(headers: Record<string, any>, name: string, value: string | string[] | ((...args: any[]) => any)) {
  let values: string[] // code below expects `values` to be an array of strings
  if (typeof value === 'function') {
    // Function values are evaluated towards the end of the response, before that we use a placeholder
    // string just to designate that the header exists. Useful when `Content-Type` is set with a function.
    values = [value.name]
  } else if (Array.isArray(value)) {
    values = value.map(String)
  } else {
    values = [String(value)]
  }

  const key = name.toLowerCase()
  if (key === 'set-cookie') {
    // Array header -- only Set-Cookie at the moment
    if (headers['set-cookie'] === undefined) {
      headers['set-cookie'] = values
    } else {
      headers['set-cookie'].push(...values)
    }
  } else if (noDuplicatesHeaders.has(key)) {
    if (headers[key] === undefined) {
      // Drop duplicates
      headers[key] = values[0]
    }
  } else {
    if (headers[key] !== undefined) {
      values = [headers[key], ...values]
    }

    const separator = key === 'cookie' ? '; ' : ', '
    headers[key] = values.join(separator)
  }
}

function deleteHeadersField(headers: Record<string, any>, fieldNameToDelete: string) {
  if (!isPlainObject(headers)) {
    throw Error('headers must be an object')
  }

  if (typeof fieldNameToDelete !== 'string') {
    throw Error('field name must be a string')
  }

  const lowerCaseFieldNameToDelete = fieldNameToDelete.toLowerCase()

  // Search through the headers and delete all values whose field name matches the given field name.
  Object.keys(headers)
    .filter(fieldName => fieldName.toLowerCase() === lowerCaseFieldNameToDelete)
    .forEach(fieldName => delete headers[fieldName])
}

function forEachHeader(rawHeaders: any[], callback: (value: any, fieldName: any, index: number) => void) {
  for (let i = 0; i < rawHeaders.length; i += 2) {
    callback(rawHeaders[i + 1], rawHeaders[i], i)
  }
}

function percentDecode(str: string) {
  try {
    return decodeURIComponent(str.replace(/\+/g, ' '))
  } catch {
    return str
  }
}

function percentEncode(str: string) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
    return `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  })
}

function matchStringOrRegexp(target: string | null | undefined, pattern: string | RegExp) {
  const targetStr =
    target === undefined || target === null ? '' : String(target)

  if (pattern instanceof RegExp) {
    // if the regexp happens to have a global flag, we want to ensure we test the entire target
    pattern.lastIndex = 0
    return pattern.test(targetStr)
  }
  return targetStr === String(pattern)
}

function formatQueryValue(key: string, value: any, stringFormattingFn?: (s: string) => string): [string, any] {
  // TODO: Probably refactor code to replace `switch(true)` with `if`/`else`.
  switch (true) {
    case typeof value === 'number': // fall-through
    case typeof value === 'boolean':
      value = value.toString()
      break
    case value === null:
    case value === undefined:
      value = ''
      break
    case typeof value === 'string':
      if (stringFormattingFn) {
        value = stringFormattingFn(value)
      }
      break
    case value instanceof RegExp:
      break
    case Array.isArray(value): {
      value = value.map(function (val: any, idx: number) {
        return formatQueryValue(String(idx), val, stringFormattingFn)[1]
      })
      break
    }
    case typeof value === 'object': {
      value = Object.entries(value).reduce(function (acc: Record<string, any>, [subKey, subVal]) {
        const subPair = formatQueryValue(subKey, subVal, stringFormattingFn)
        acc[subPair[0]] = subPair[1]

        return acc
      }, {})
      break
    }
  }

  if (stringFormattingFn) key = stringFormattingFn(key)
  return [key, value]
}

function isStream(obj: any) {
  return (
    obj &&
    typeof obj !== 'string' &&
    !Buffer.isBuffer(obj) &&
    typeof obj.setEncoding === 'function'
  )
}

const dataEqual = (expected: any, actual: any) => {
  if (isPlainObject(expected)) {
    expected = expand(expected)
  }
  if (isPlainObject(actual)) {
    actual = expand(actual)
  }
  return deepEqual(expected, actual)
}

function deepEqual(expected: any, actual: any): boolean {
  debug('deepEqual comparing', typeof expected, expected, typeof actual, actual)
  if (expected instanceof RegExp) {
    return expected.test(actual)
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return false
    }

    return expected.every((expVal, idx) => deepEqual(expVal, actual[idx]))
  }

  if (isPlainObject(expected) && isPlainObject(actual)) {
    const allKeys = Array.from(
      new Set(Object.keys(expected).concat(Object.keys(actual))),
    )

    return allKeys.every(key => deepEqual(expected[key], actual[key]))
  }

  return expected === actual
}

const timeouts = new Set()
const immediates = new Set()

const wrapTimer =
  (timer: (...args: any[]) => any, ids: Set<any>) =>
  (callback: (...args: any[]) => any, ...timerArgs: any[]) => {
    const cb = (...callbackArgs: any[]) => {
      try {
        callback(...callbackArgs)
      } finally {
        ids.delete(id)
      }
    }
    const id = timer(cb, ...timerArgs)
    ids.add(id)
    return id
  }

const setTimeout = wrapTimer(timers.setTimeout, timeouts)
const setImmediate = wrapTimer(timers.setImmediate, immediates)

function clearTimer(clear: (id: any) => void, ids: Set<any>) {
  ids.forEach(clear)
  ids.clear()
}

function removeAllTimers() {
  debug('remove all timers')
  clearTimer(clearTimeout, timeouts)
  clearTimer(clearImmediate, immediates)
}

function isPlainObject(value: any) {
  if (typeof value !== 'object' || value === null) return false

  if (Object.prototype.toString.call(value) !== '[object Object]') return false

  const proto = Object.getPrototypeOf(value)
  if (proto === null) return true

  const Ctor =
    Object.prototype.hasOwnProperty.call(proto, 'constructor') &&
    proto.constructor
  return (
    typeof Ctor === 'function' &&
    Ctor instanceof Ctor &&
    Function.prototype.call(Ctor) === Function.prototype.call(value)
  )
}

const prototypePollutionBlockList = ['__proto__', 'prototype', 'constructor']
const blocklistFilter = function (part: string) {
  return prototypePollutionBlockList.indexOf(part) === -1
}

const expand = (input: Record<string, any> | null | undefined) => {
  if (input === undefined || input === null) {
    return input
  }

  const keys = Object.keys(input)

  const result: Record<string, any> = {}
  let resultPtr: Record<string, any> = result

  for (let path of keys) {
    const originalPath = path
    if (path.indexOf('[') >= 0) {
      path = path.replace(/\[/g, '.').replace(/]/g, '')
    }

    const parts = path.split('.')

    const check = parts.filter(blocklistFilter)

    if (check.length !== parts.length) {
      return undefined
    }
    resultPtr = result
    const lastIndex = parts.length - 1

    for (let i = 0; i < parts.length; ++i) {
      const part = parts[i]
      if (i === lastIndex) {
        if (Array.isArray(resultPtr)) {
          resultPtr[+part] = input[originalPath]
        } else {
          resultPtr[part] = input[originalPath]
        }
      } else {
        if (resultPtr[part] === undefined || resultPtr[part] === null) {
          const nextPart = parts[i + 1]
          if (/^\d+$/.test(nextPart)) {
            resultPtr[part] = []
          } else {
            resultPtr[part] = {}
          }
        }
        resultPtr = resultPtr[part]
      }
    }
  }
  return result
}

function decompressRequestBody(buffer: ArrayBuffer, contentEncoding: string) {
  const encodings = contentEncoding
    .toLowerCase()
    .split(',')
    .map(coding => coding.trim())

  for (const encoding of encodings) {
    if (encoding === 'gzip') {
      return zlib.gunzipSync(buffer)
    } else if (encoding === 'deflate') {
      return zlib.inflateSync(buffer)
    } else if (encoding === 'br') {
      return zlib.brotliDecompressSync(buffer)
    }
  }

  return buffer
}

function convertHeadersToRaw(headers: Headers) {
  const rawHeaders: string[] = []
  for (const [name, value] of headers.entries()) {
    rawHeaders.push(name, value)
  }
  return rawHeaders
}

export {
  contentEncoding,
  dataEqual,
  deleteHeadersField,
  expand,
  forEachHeader,
  formatQueryValue,
  headersArrayToObject,
  headersFieldNamesToLowerCase,
  headersFieldsArrayToLowerCase,
  headersInputToRawArray,
  isContentEncoded,
  isJSONContent,
  isPlainObject,
  isStream,
  isUtf8Representable,
  matchStringOrRegexp,
  normalizeOrigin,
  normalizeRequestOptions,
  percentDecode,
  percentEncode,
  removeAllTimers,
  setImmediate,
  setTimeout,
  stringifyRequest,
  decompressRequestBody,
  convertHeadersToRaw,
}
