'use strict'

const fs = require('node:fs')
const querystring = require('node:querystring')
const { URL, URLSearchParams } = require('node:url')

const stringify = require('./stringify')
const common = require('./common')
const { remove } = require('./intercept')
const matchBody = require('./match_body')

module.exports = class Interceptor {
  /**
   *
   * Valid argument types for `uri`:
   *  - A string used for strict comparisons with pathname.
   *    The search portion of the URI may also be postfixed, in which case the search params
   *    are striped and added via the `query` method.
   *  - A RegExp instance that tests against only the pathname of requests.
   *  - A synchronous function bound to this Interceptor instance. It's provided the pathname
   *    of requests and must return a boolean denoting if the request is considered a match.
   */
  constructor(scope, uri, method, requestBody, interceptorOptions) {
    const uriIsStr = typeof uri === 'string'
    // Check for leading slash. Uri can be either a string or a regexp, but
    // When enabled filteringScope ignores the passed URL entirely so we skip validation.

    if (
      uriIsStr &&
      !scope.scopeOptions.filteringScope &&
      !scope.basePathname &&
      !uri.startsWith('/') &&
      !uri.startsWith('*')
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

    // strip off literal query parameters if they were provided as part of the URI
    if (uriIsStr && uri.includes('?')) {
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

  replyWithError(errorMessage) {
    this.errorMessage = errorMessage

    this.options = {
      ...this.scope.scopeOptions,
      ...this.options,
    }

    this.scope.add(this._key, this)
    return this.scope
  }

  reply(statusCode, body, rawHeaders) {
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

      if (!this.headers['content-type']) {
        // https://tools.ietf.org/html/rfc7231#section-3.1.1.5
        this.rawHeaders.push('Content-Type', 'application/json')
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

  replyWithFile(statusCode, filePath, headers) {
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

  reqheaderMatches(expected, actual, key) {
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

  /**
   * @param {Request} request
   * @param {string} body - string or hex
   * @returns {string[]}
   */
  match(request, body) {
    const url = new URL(request.url)
    // TODO: fix request log to string
    this.scope.logger('attempting match %j, body = %j', request, body)

    const mismatches = []
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

    const requestMatchesFilter = ({ name, value: predicate }) => {
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

    const reqHeadersMatch = Object.keys(this.reqheaders).every(key =>
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

    const badHeaders = this.badheaders.filter(header =>
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
      const [pathname, search] = path.split('?')
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
      matchKey = this.__nock_filteredScope
    } else {
      matchKey = common.normalizeOrigin(url)
    }

    if (!common.matchStringOrRegexp(matchKey, this.basePath)) {
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
    } else if (!common.matchStringOrRegexp(path, this.path)) {
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

  /**
   * Return true when the interceptor's method, protocol, host, port, and path
   * match the provided options.
   *
   * @param {Request} request
   */
  matchOrigin(request) {
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
    const comparisonKey = isPathFn || isRegex ? this.__nock_scopeKey : this._key
    const matchKey = `${method} ${url.protocol}//${url.hostname}:${port}${path}`

    if (isPathFn) {
      return !!(matchKey.match(comparisonKey) && this.path(path))
    }

    if (isRegex && !isRegexBasePath) {
      return !!matchKey.match(comparisonKey) && this.path.test(path)
    }

    if (isRegexBasePath) {
      return this.scope.basePath.test(matchKey) && !!path.match(this.path)
    }

    return comparisonKey === matchKey
  }

  /**
   * @param {string} hostname
   */
  matchHostName(hostname) {
    const { basePath } = this.scope

    if (basePath instanceof RegExp) {
      return basePath.test(hostname)
    }

    return hostname === this.scope.urlParts.hostname
  }

  matchQuery(options) {
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

  filteringPath(...args) {
    this.scope.filteringPath(...args)
    return this
  }

  // TODO filtering by path is valid on the intercept level, but not filtering
  // by request body?

  markConsumed() {
    this.interceptionCounter++

    remove(this)

    if (!this.scope.shouldPersist() && this.counter < 1) {
      this.scope.remove(this._key, this)
    }
  }

  matchHeader(name, value) {
    this.interceptorMatchHeaders.push({ name, value })
    return this
  }

  basicAuth({ user, pass = '' }) {
    const encoded = Buffer.from(`${user}:${pass}`).toString('base64')
    this.matchHeader('authorization', `Basic ${encoded}`)
    return this
  }

  /**
   * Set query strings for the interceptor
   * @name query
   * @param queries Object of query string name,values (accepts regexp values)
   * @public
   * @example
   * // Will match 'http://zombo.com/?q=t'
   * nock('http://zombo.com').get('/').query({q: 't'});
   */
  query(queries) {
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

    this.queries = {}
    for (const [key, value] of Object.entries(queries)) {
      const formatted = common.formatQueryValue(key, value, strFormattingFn)
      const [formattedKey, formattedValue] = formatted
      this.queries[formattedKey] = formattedValue
    }

    return this
  }

  /**
   * Set number of times will repeat the interceptor
   * @name times
   * @param newCounter Number of times to repeat (should be > 0)
   * @public
   * @example
   * // Will repeat mock 5 times for same king of request
   * nock('http://zombo.com).get('/').times(5).reply(200, 'Ok');
   */
  times(newCounter) {
    if (newCounter < 1) {
      return this
    }

    this.counter = newCounter

    return this
  }

  /**
   * An sugar syntax for times(1)
   * @name once
   * @see {@link times}
   * @public
   * @example
   * nock('http://zombo.com).get('/').once().reply(200, 'Ok');
   */
  once() {
    return this.times(1)
  }

  /**
   * An sugar syntax for times(2)
   * @name twice
   * @see {@link times}
   * @public
   * @example
   * nock('http://zombo.com).get('/').twice().reply(200, 'Ok');
   */
  twice() {
    return this.times(2)
  }

  /**
   * An sugar syntax for times(3).
   * @name thrice
   * @see {@link times}
   * @public
   * @example
   * nock('http://zombo.com).get('/').thrice().reply(200, 'Ok');
   */
  thrice() {
    return this.times(3)
  }

  /**
   * Delay the response by a certain number of ms.
   *
   * @param {number} ms - Number of milliseconds to wait before response is sent
   * @return {Interceptor} - the current interceptor for chaining
   */
  delay(ms) {
    if (typeof ms === 'number') {
      this.delayBodyInMs = ms
      return this
    } else {
      throw new Error(`Unexpected input ${ms}`)
    }
  }
}
