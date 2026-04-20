import querystring from 'node:querystring'
import * as common from './common.ts'

export default function matchBody(request: Request, spec: any, body: string) {
  if (spec instanceof RegExp) {
    return spec.test(body)
  }

  if (Buffer.isBuffer(spec)) {
    const encoding = common.isUtf8Representable(spec) ? 'utf8' : 'hex'
    spec = spec.toString(encoding)
  }

  const contentType = request.headers.get('content-type') || ''
  const isMultipart = contentType.includes('multipart')
  const isUrlencoded = contentType.includes('application/x-www-form-urlencoded')

  // try to transform body to json or query string
  let json
  let matchBody: string | Record<string, any> = body
  if (typeof spec === 'object' || typeof spec === 'function') {
    try {
      json = JSON.parse(body)
    } catch {
      // not a valid JSON string
    }
    if (json !== undefined) {
      matchBody = json
    } else if (isUrlencoded) {
      matchBody = querystring.parse(body)
    }
  }

  if (typeof spec === 'function') {
    return spec(matchBody)
  }

  // strip line endings from both so that we get a match no matter what OS we are running on
  // if Content-Type does not contain 'multipart'
  if (!isMultipart && typeof matchBody === 'string') {
    matchBody = matchBody.replace(/\r?\n|\r/g, '')
  }

  if (!isMultipart && typeof spec === 'string') {
    spec = spec.replace(/\r?\n|\r/g, '')
  }

  // Because the nature of URL encoding, all the values in the body must be cast to strings.
  // dataEqual does strict checking, so we have to cast the non-regexp values in the spec too.
  if (isUrlencoded) {
    spec = mapValuesDeep(spec, (val: any) => (val instanceof RegExp ? val : `${val}`))
  }

  return common.dataEqual(spec, matchBody)
}

function mapValues(object: Record<string, any>, cb: (value: any, key: string, object: Record<string, any>) => any) {
  const keys = Object.keys(object)
  const clonedObject = { ...object }
  for (const key of keys) {
    clonedObject[key] = cb(clonedObject[key], key, clonedObject)
  }
  return clonedObject
}

function mapValuesDeep(obj: any, cb: (value: any) => any): any {
  if (Array.isArray(obj)) {
    return obj.map((v: any) => mapValuesDeep(v, cb))
  }
  if (common.isPlainObject(obj)) {
    return mapValues(obj, (v: any) => mapValuesDeep(v, cb))
  }
  return cb(obj)
}
