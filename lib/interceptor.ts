import type { ReadStream } from 'node:fs'
import type { Scope, Options } from './scope.ts'

export type DataMatcher =
  | boolean
  | number
  | string
  | null
  | undefined
  | RegExp
  | DataMatcherArray
  | DataMatcherMap
export type DataMatcherArray = ReadonlyArray<DataMatcher>
export type DataMatcherMap = { [key: string]: DataMatcher }

export type RequestBodyMatcher =
  | string
  | Buffer
  | RegExp
  | DataMatcherArray
  | DataMatcherMap
  | ((body: any) => boolean)

export type RequestHeaderMatcher =
  | string
  | RegExp
  | ((fieldValue: string | null) => boolean)

export type Body = string | Record<string, any>
export type ReplyBody = Body | Buffer | ReadStream

export type ReplyHeaderFunction = (
  req: Request,
  body?: string | Buffer,
) => string | string[] | Promise<string | string[]>
export type ReplyHeaderValue = string | string[] | ReplyHeaderFunction
export type ReplyHeaders =
  | Record<string, ReplyHeaderValue>
  | Map<string, ReplyHeaderValue>
  | ReplyHeaderValue[]

export type StatusCode = number
export type ReplyFnResult =
  | readonly [StatusCode]
  | readonly [StatusCode, ReplyBody]
  | readonly [StatusCode, ReplyBody, ReplyHeaders]

import fs from 'node:fs'
import querystring from 'node:querystring'
import { URL, URLSearchParams } from 'node:url'

import stringify from './stringify.ts'
import * as common from './common.ts'
import { remove } from './intercept.ts'
import matchBody from './match_body.ts'

class Interceptor {
  declare scope: Scope
  declare interceptorMatchHeaders: {name: string, value: any}[]
  declare method: string
  declare uri: string | RegExp | ((path: string) => boolean)
  declare _key: string
  declare basePath: string | RegExp
  declare path: string | RegExp | ((path: string) => boolean)
  declare queries: null | boolean | ((queryObject: Record<string, any>) => boolean) | Record<string, any>
  declare options: Options & Record<string, any>
  declare counter: number
  declare _requestBody: RequestBodyMatcher | undefined
  declare reqheaders: Record<string, any>
  declare badheaders: string[]
  declare delayBodyInMs: number
  declare optional: boolean
  declare isPassthrough: boolean
  declare __nock_filteredScope: string | undefined
  declare __nock_scopeKey: string | undefined
  declare __nock_scope: Scope | undefined
  declare __nock_scopeOptions: Record<string, any> | undefined
  declare __nock_scopeHost: string | undefined
  declare interceptionCounter: number
  declare statusCode: number | null | undefined
  declare headers: Record<string, any> | undefined
  declare rawHeaders: any[]
  declare body: any
  declare errorMessage: any
  declare filePath: string | undefined
  declare fullReplyFunction: any
  declare replyFunction: any

  constructor(scope: Scope, uri: string | RegExp | ((path: string) => boolean), method: string, requestBody?: RequestBodyMatcher, interceptorOptions?: Options) {
    const uriIsStr = typeof uri === 'string'
    // Check for leading slash. Uri can be either a string or a regexp, but
    // When enabled filteringScope ignores the passed URL entirely so we skip validation.

    if (
      uriIsStr &&
      !scope.scopeOptions.filteringScope &&
      !scope.basePathname &&
      !(uri as string).startsWith('/') &&
      !(uri as string).startsWith('*')
    ) {
      throw Error(
        `Non-wildcard URL path strings must begin with a slash (otherwise they won't match anything) (got: ${uri})`,
      )
    }

    if (!method) {
      throw new Error(
        'The "method" parameter is required for an intercept call.',
      )
    }

    this.scope = scope
    this.interceptorMatchHeaders = []
    this.method = method.toUpperCase()
    this.uri = uri
    this._key = `${this.method} ${scope.basePath}${scope.basePathname}${
      uriIsStr ? '' : '/'
    }${uri}`
    this.basePath = this.scope.basePath
    this.path = uriIsStr ? scope.basePathname + uri : uri
    this.queries = null

    this.options = interceptorOptions || {}
    this.counter = 1
    this._requestBody = requestBody

    //  We use lower-case header field names throughout Nock.
    this.reqheaders = common.headersFieldNamesToLowerCase(
      scope.scopeOptions.reqheaders || {},
      true,
    )
    this.badheaders = common.headersFieldsArrayToLowerCase(
      scope.scopeOptions.badheaders || [],
    )

    this.delayBodyInMs = 0

    this.optional = false
    this.isPassthrough = false

    this.__nock_filteredScope = undefined
    this.__nock_scopeKey = undefined
    this.__nock_scope = undefined
    this.__nock_scopeOptions = undefined
    this.__nock_scopeHost = undefined
    this.interceptionCounter = 0
    this.statusCode = undefined
    this.headers = undefined
    this.rawHeaders = []

    // strip off literal query parameters if they were provided as part of the URI
    if (uriIsStr && (uri as string).includes('?')) {
      // localhost is a dummy value because the URL constructor errors for only relative inputs
      const parsedURL = new URL(this.path, 'http://localhost')
      this.path = parsedURL.pathname
      this.query(parsedURL.searchParams)
      this._key = `${this.method} ${scope.basePath}${this.path}`
    }
  }

  optionally(flag = true) {
    // The default behaviour of optionally() with no arguments is to make the mock optional.
    if (typeof flag !== 'boolean') {
      throw new Error('Invalid arguments: argument should be a boolean')
    }

    this.optional = flag

    return this
  }

  passthrough() {
    this.isPassthrough = true

    this.options = {
      ...this.scope.scopeOptions,
      ...this.options,
    }

    this.scope.add(this._key, this)
    return this.scope
  }

  replyWithError(errorMessage: string | Error | Record<string, any>) {
    this.errorMessage = errorMessage

    this.options = {
      ...this.scope.scopeOptions,
      ...this.options,
    }

    this.scope.add(this._key, this)
    return this.scope
  }

  reply(statusCode: any, body?: any, rawHeaders?: ReplyHeaders) {
    // support the format of only passing in a callback
    if (typeof statusCode === 'function') {
      if (arguments.length > 1) {
        // It's not very Javascript-y to throw an error for extra args to a function, but because
        // of legacy behavior, this error was added to reduce confusion for those migrating.
        throw Error(
          'Invalid arguments. When providing a function for the first argument, .reply does not accept other arguments.',
        )
      }
      this.statusCode = null
      this.fullReplyFunction = statusCode
    } else {
      if (statusCode !== undefined && !Number.isInteger(statusCode)) {
        throw new Error(`Invalid ${typeof statusCode} value for status code`)
      }

      this.statusCode = statusCode || 200
      if (typeof body === 'function') {
        this.replyFunction = body
        body = null
      }
    }

    this.options = {
      ...this.scope.scopeOptions,
      ...this.options,
    }

    this.rawHeaders = common.headersInputToRawArray(rawHeaders)

    if (this.scope.date) {
      // https://tools.ietf.org/html/rfc7231#section-7.1.1.2
      this.rawHeaders.push('Date', this.scope.date.toUTCString())
    }

    // Prepare the headers temporarily so we can make best guesses about content-encoding and content-type
    // below as well as while the response is being processed in RequestOverrider.end().
    // Including all the default headers is safe for our purposes because of the specific headers we introspect.
    // A more thoughtful process is used to merge the default headers when the response headers are finally computed.
    this.headers = common.headersArrayToObject(
      this.rawHeaders.concat(this.scope._defaultReplyHeaders),
    )

    //  If the content is not encoded we may need to transform the response body.
    //  Otherwise, we leave it as it is.
    if (
      body &&
      typeof body !== 'string' &&
      !Buffer.isBuffer(body) &&
      !common.isStream(body) &&
      !common.isContentEncoded(this.headers)
    ) {
      try {
        body = stringify(body)
      } catch {
        throw new Error('Error encoding response body into JSON')
      }

      if (!this.headers!['content-type']) {
        // https://tools.ietf.org/html/rfc7231#section-3.1.1.5
        this.rawHeaders.push('Content-Type', 'application/json')
      }

      // Fix content-length header if it exists and doesn't match the stringified body
      const contentLengthIndex = this.rawHeaders.findIndex(
        (value: any, index: number) =>
          index % 2 === 0 && value.toLowerCase() === 'content-length',
      )
      if (contentLengthIndex !== -1) {
        const actualLength = Buffer.byteLength(body, 'utf8')
        this.rawHeaders[contentLengthIndex + 1] = String(actualLength)
      }
    }

    if (this.scope.contentLen) {
      // https://tools.ietf.org/html/rfc7230#section-3.3.2
      if (typeof body === 'string') {
        this.rawHeaders.push('Content-Length', body.length)
      } else if (Buffer.isBuffer(body)) {
        this.rawHeaders.push('Content-Length', body.byteLength)
      }
    }

    this.scope.logger('reply.headers:', this.headers)
    this.scope.logger('reply.rawHeaders:', this.rawHeaders)

    this.body = body

    this.scope.add(this._key, this)
    return this.scope
  }

  replyWithFile(statusCode: number, filePath: string, headers?: ReplyHeaders) {
    if (!fs) {
      throw new Error('No fs')
    }
    this.filePath = filePath
    return this.reply(
      statusCode,
      () => {
        const readStream = fs.createReadStream(filePath)
        readStream.pause()
        return readStream
      },
      headers,
    )
  }

  reqheaderMatches(expected: RequestHeaderMatcher, actual: string | null, key: string) {
    if (expected !== undefined && actual !== undefined) {
      if (typeof expected === 'function') {
        return expected(actual)
      } else if (common.matchStringOrRegexp(actual, expected)) {
        return true
      }
    }

    this.scope.logger(
      "request header field doesn't match:",
      key,
      actual,
      expected,
    )
    return false
  }

  match(request: Request, body: string) {
    const url = new URL(request.url)
    // TODO: fix request log to string
    this.scope.logger('attempting match %j, body = %j', request, body)

    const mismatches: string[] = []
    let path = url.pathname + url.search
    let matchKey

    if (this.method !== request.method) {
      const msg = `Method mismatch: expected ${this.method}, got ${request.method}`
      this.scope.logger(msg)
      mismatches.push(msg)
    }

    if (this.scope.transformPathFunction) {
      path = this.scope.transformPathFunction(path)
    }

    const requestMatchesFilter = ({ name, value: predicate }: {name: string, value: any}) => {
      const headerValue = request.headers.get(name)
      if (typeof predicate === 'function') {
        return predicate(headerValue)
      } else {
        return common.matchStringOrRegexp(headerValue, predicate)
      }
    }

    for (const header of [
      ...this.scope.matchHeaders,
      ...this.interceptorMatchHeaders,
    ]) {
      if (!requestMatchesFilter(header)) {
        const msg = `Header mismatch: expected ${header.name} to match ${header.value}, got ${request.headers.get(header.name)}`
        this.scope.logger(msg)
        mismatches.push(msg)
      }
    }

    const reqHeadersMatch = Object.keys(this.reqheaders).every((key: string) =>
      this.reqheaderMatches(
        this.reqheaders[key],
        request.headers.get(key),
        key,
      ),
    )

    if (!reqHeadersMatch) {
      const msg = "Request headers don't match"
      this.scope.logger(msg)
      mismatches.push(msg)
    }

    if (
      this.scope.scopeOptions.conditionally &&
      !this.scope.scopeOptions.conditionally()
    ) {
      const msg = 'conditionally() did not validate'
      this.scope.logger(msg)
      mismatches.push(msg)
    }

    const badHeaders = this.badheaders.filter((header: string) =>
      request.headers.has(header),
    )

    if (badHeaders.length) {
      const msg = `Request contains bad headers: ${badHeaders.join(', ')}`
      this.scope.logger(msg)
      mismatches.push(msg)
    }

    // Match query strings when using query()
    if (this.queries === null) {
      this.scope.logger('query matching skipped')
    } else {
      // can't rely on pathname or search being in the options, but path has a default
      const [pathname, search] = (path as string).split('?')
      const matchQueries = this.matchQuery({ search })

      if (!matchQueries) {
        const msg = 'query matching failed'
        this.scope.logger(msg)
        mismatches.push(msg)
      }

      // If the query string was explicitly checked then subsequent checks against
      // the path using a callback or regexp only validate the pathname.
      path = pathname
    }

    // If we have a filtered scope then we use it instead reconstructing the
    // scope from the request options (proto, host and port) as these two won't
    // necessarily match and we have to remove the scope that was matched (vs.
    // that was defined).
    if (this.__nock_filteredScope) {
      matchKey = this.__nock_filteredScope as string
    } else {
      matchKey = common.normalizeOrigin(url)
    }

    if (!common.matchStringOrRegexp(matchKey, this.basePath as string | RegExp)) {
      const msg = `Base path mismatch: expected ${this.basePath}, got ${matchKey}`
      this.scope.logger(msg)
      mismatches.push(msg)
    }

    if (typeof this.uri === 'function') {
      if (!this.uri.call(this, path)) {
        const msg = `Path function mismatch: expected function to return true for ${path}`
        this.scope.logger(msg)
        mismatches.push(msg)
      }
    } else if (!common.matchStringOrRegexp(path, this.path as string | RegExp)) {
      const msg = `Path mismatch: expected ${this.path}, got ${path}`
      this.scope.logger(msg)
      mismatches.push(msg)
    }

    if (this._requestBody !== undefined) {
      if (this.scope.transformRequestBodyFunction) {
        body = this.scope.transformRequestBodyFunction(body, this._requestBody)
      }

      if (!matchBody(request, this._requestBody, body)) {
        const msg = `Body mismatch: expected ${stringify(this._requestBody)}, got ${body}`
        this.scope.logger(msg)
        mismatches.push(msg)
      }
    }

    return mismatches
  }

  matchOrigin(request: Request) {
    const url = new URL(request.url)
    const isPathFn = typeof this.path === 'function'
    const isRegex = this.path instanceof RegExp
    const isRegexBasePath = this.scope.basePath instanceof RegExp

    const method = (request.method || 'GET').toUpperCase()
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    let path = url.pathname + url.search

    // NOTE: Do not split off the query params as the regex could use them
    if (!isRegex) {
      path = path ? path.split('?')[0] : ''
    }

    if (this.scope.transformPathFunction) {
      path = this.scope.transformPathFunction(path)
    }
    const comparisonKey = isPathFn || isRegex ? this.__nock_scopeKey as string : this._key
    const matchKey = `${method} ${url.protocol}//${url.hostname}:${port}${path}`

    if (isPathFn) {
      return !!(matchKey.match(comparisonKey) && (this.path as Function)(path))
    }

    if (isRegex && !isRegexBasePath) {
      return !!matchKey.match(comparisonKey) && (this.path as RegExp).test(path)
    }

    if (isRegexBasePath) {
      return (this.scope.basePath as RegExp).test(matchKey) && !!path.match(this.path as string)
    }

    return comparisonKey === matchKey
  }

  matchHostName(hostname: string) {
    const { basePath } = this.scope

    if (basePath instanceof RegExp) {
      return basePath.test(hostname)
    }

    return hostname === this.scope.urlParts.hostname
  }

  matchQuery(options: Record<string, any>) {
    if (this.queries === true) {
      return true
    }

    const reqQueries = querystring.parse(options.search)
    this.scope.logger('Interceptor queries: %j', this.queries)
    this.scope.logger('    Request queries: %j', reqQueries)

    if (typeof this.queries === 'function') {
      return this.queries(reqQueries)
    }

    return common.dataEqual(this.queries, reqQueries)
  }

  filteringPath(...args: any[]) {
    ;(this.scope.filteringPath as Function).apply(this.scope, args)
    return this
  }

  // TODO filtering by path is valid on the intercept level, but not filtering
  // by request body?

  markConsumed() {
    this.interceptionCounter = (this.interceptionCounter || 0) + 1

    remove(this)

    if (!this.scope.shouldPersist() && this.counter < 1) {
      this.scope.remove(this._key, this)
    }
  }

  matchHeader(name: string, value: RequestHeaderMatcher) {
    this.interceptorMatchHeaders.push({ name, value })
    return this
  }

  basicAuth({ user, pass = '' }: {user: string, pass?: string}) {
    const encoded = Buffer.from(`${user}:${pass}`).toString('base64')
    this.matchHeader('authorization', `Basic ${encoded}`)
    return this
  }

  query(queries: boolean | string | URLSearchParams | Record<string, any> | ((queryObject: Record<string, any>) => boolean)) {
    if (this.queries !== null) {
      throw Error(`Query parameters have already been defined`)
    }

    // Allow all query strings to match this route
    if (queries === true) {
      this.queries = queries
      return this
    }

    if (typeof queries === 'function') {
      this.queries = queries
      return this
    }

    let strFormattingFn
    if (this.scope.scopeOptions.encodedQueryParams) {
      strFormattingFn = common.percentDecode
    }

    if (queries instanceof URLSearchParams || typeof queries === 'string') {
      // Normalize the data into the shape that is matched against.
      // Duplicate keys are handled by combining the values into an array.
      queries = querystring.parse(queries.toString())
    } else if (!common.isPlainObject(queries)) {
      throw Error(`Argument Error: ${queries}`)
    }

    this.queries = {} as Record<string, any>
    for (const [key, value] of Object.entries(queries)) {
      const formatted = common.formatQueryValue(key, value, strFormattingFn)
      const [formattedKey, formattedValue] = formatted
      ;(this.queries as Record<string, any>)[formattedKey] = formattedValue
    }

    return this
  }

  times(newCounter: number) {
    if (newCounter < 1) {
      return this
    }

    this.counter = newCounter

    return this
  }

  once() {
    return this.times(1)
  }

  twice() {
    return this.times(2)
  }

  thrice() {
    return this.times(3)
  }

  delay(ms: number) {
    if (typeof ms === 'number') {
      this.delayBodyInMs = ms
      return this
    } else {
      throw new Error(`Unexpected input ${ms}`)
    }
  }
}

export { Interceptor }
