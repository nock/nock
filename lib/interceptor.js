'use strict'

const matchBody = require('./match_body')
const common = require('./common')
const _ = require('lodash')
const debug = require('debug')('nock.interceptor')
const stringify = require('json-stringify-safe')
const qs = require('qs')
const url = require('url')

let fs
try {
  fs = require('fs')
} catch (err) {
  // do nothing, we're in the browser
}

module.exports = Interceptor

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
function Interceptor(scope, uri, method, requestBody, interceptorOptions) {
  const uriIsStr = typeof uri === 'string'
  // Check for leading slash. Uri can be either a string or a regexp, but
  // we only need to check strings.
  if (uriIsStr && /^[^/*]/.test(uri)) {
    throw Error(
      "Non-wildcard URL path strings must begin with a slash (otherwise they won't match anything)"
    )
  }

  if (!method) {
    throw new Error('The "method" parameter is required for an intercept call.')
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
    (scope.scopeOptions && scope.scopeOptions.reqheaders) || {}
  )
  this.badheaders = common.headersFieldsArrayToLowerCase(
    (scope.scopeOptions && scope.scopeOptions.badheaders) || []
  )

  this.delayInMs = 0
  this.delayConnectionInMs = 0

  this.optional = false

  // strip off literal query parameters if they were provided as part of the URI
  if (uriIsStr && uri.includes('?')) {
    // localhost is a dummy value because the URL constructor errors for only relative inputs
    const parsedURL = new url.URL(this.path, 'http://localhost')
    this.path = parsedURL.pathname
    this.query(parsedURL.searchParams)
    this._key = `${this.method} ${scope.basePath}${this.path}`
  }
}

Interceptor.prototype.optionally = function optionally(value) {
  // The default behaviour of optionally() with no arguments is to make the mock optional.
  value = typeof value === 'undefined' ? true : value

  this.optional = value

  return this
}

Interceptor.prototype.replyWithError = function replyWithError(errorMessage) {
  this.errorMessage = errorMessage

  _.defaults(this.options, this.scope.scopeOptions)

  this.scope.add(this._key, this, this.scope, this.scopeOptions)
  return this.scope
}

Interceptor.prototype.reply = function reply(statusCode, body, rawHeaders) {
  // support the format of only passing in a callback
  if (_.isFunction(statusCode)) {
    if (arguments.length > 1) {
      // It's not very Javascript-y to throw an error for extra args to a function, but because
      // of legacy behavior, this error was added to reduce confusion for those migrating.
      throw Error(
        'Invalid arguments. When providing a function for the first argument, .reply does not accept other arguments.'
      )
    }
    this.statusCode = null
    this.fullReplyFunction = statusCode
  } else {
    if (statusCode !== undefined && !Number.isInteger(statusCode)) {
      throw new Error(`Invalid ${typeof statusCode} value for status code`)
    }

    this.statusCode = statusCode || 200
    if (_.isFunction(body)) {
      this.replyFunction = body
      body = null
    }
  }

  _.defaults(this.options, this.scope.scopeOptions)

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
    this.rawHeaders.concat(this.scope._defaultReplyHeaders)
  )

  //  If the content is not encoded we may need to transform the response body.
  //  Otherwise we leave it as it is.
  if (
    body &&
    typeof body !== 'string' &&
    !Buffer.isBuffer(body) &&
    !common.isStream(body) &&
    !common.isContentEncoded(this.headers)
  ) {
    try {
      body = stringify(body)
    } catch (err) {
      throw new Error('Error encoding response body into JSON')
    }

    if (!this.headers['content-type']) {
      // https://tools.ietf.org/html/rfc7231#section-3.1.1.5
      this.rawHeaders.push('Content-Type', 'application/json')
    }

    if (this.scope.contentLen) {
      // https://tools.ietf.org/html/rfc7230#section-3.3.2
      this.rawHeaders.push('Content-Length', body.length)
    }
  }

  debug('reply.headers:', this.headers)
  debug('reply.rawHeaders:', this.rawHeaders)

  this.body = body

  this.scope.add(this._key, this, this.scope, this.scopeOptions)
  return this.scope
}

Interceptor.prototype.replyWithFile = function replyWithFile(
  statusCode,
  filePath,
  headers
) {
  if (!fs) {
    throw new Error('No fs')
  }
  const readStream = fs.createReadStream(filePath)
  readStream.pause()
  this.filePath = filePath
  return this.reply(statusCode, readStream, headers)
}

// Also match request headers
// https://github.com/nock/nock/issues/163
Interceptor.prototype.reqheaderMatches = function reqheaderMatches(
  options,
  key
) {
  const reqHeader = this.reqheaders[key]
  let header = options.headers[key]
  if (header && typeof header !== 'string' && header.toString) {
    header = header.toString()
  }

  // We skip 'host' header comparison unless it's available in both mock and
  // actual request. This because 'host' may get inserted by Nock itself and
  // then get recorded. NOTE: We use lower-case header field names throughout
  // Nock. See https://github.com/nock/nock/pull/196.
  if (key === 'host' && (header === undefined || reqHeader === undefined)) {
    return true
  }

  if (!_.isUndefined(reqHeader) && !_.isUndefined(header)) {
    if (_.isFunction(reqHeader)) {
      return reqHeader(header)
    } else if (common.matchStringOrRegexp(header, reqHeader)) {
      return true
    }
  }

  debug("request header field doesn't match:", key, header, reqHeader)
  return false
}

Interceptor.prototype.match = function match(options, body) {
  if (debug.enabled) {
    debug('match %s, body = %s', stringify(options), stringify(body))
  }

  const method = (options.method || 'GET').toUpperCase()
  let { path } = options
  let matches
  let matchKey
  const { proto } = options

  if (this.scope.transformPathFunction) {
    path = this.scope.transformPathFunction(path)
  }

  const requestMatchesFilter = ({ name, value: predicate }) => {
    const headerValue = options.getHeader(name)
    if (typeof predicate === 'function') {
      return predicate(headerValue)
    } else {
      return common.matchStringOrRegexp(headerValue, predicate)
    }
  }

  if (
    !this.scope.matchHeaders.every(requestMatchesFilter) ||
    !this.interceptorMatchHeaders.every(requestMatchesFilter)
  ) {
    this.scope.logger("headers don't match")
    return false
  }

  const reqHeadersMatch = Object.keys(this.reqheaders).every(key =>
    this.reqheaderMatches(options, key)
  )

  if (!reqHeadersMatch) {
    return false
  }

  if (
    this.scope.scopeOptions &&
    this.scope.scopeOptions.conditionally &&
    !this.scope.scopeOptions.conditionally()
  ) {
    return false
  }

  function reqheaderContains(header) {
    return _.has(options.headers, header)
  }

  const reqContainsBadHeaders =
    this.badheaders && _.some(this.badheaders, reqheaderContains)

  if (reqContainsBadHeaders) {
    return false
  }

  //  If we have a filtered scope then we use it instead reconstructing
  //  the scope from the request options (proto, host and port) as these
  //  two won't necessarily match and we have to remove the scope that was
  //  matched (vs. that was defined).
  if (this.__nock_filteredScope) {
    matchKey = this.__nock_filteredScope
  } else {
    matchKey = common.normalizeOrigin(proto, options.host, options.port)
  }

  // Match query strings when using query()
  let matchQueries = true
  let queryIndex = -1
  let queryString
  let queries

  if (this.queries) {
    queryIndex = path.indexOf('?')
    queryString = queryIndex !== -1 ? path.slice(queryIndex + 1) : ''
    queries = qs.parse(queryString)

    // Only check for query string matches if this.queries is an object
    if (_.isObject(this.queries)) {
      if (_.isFunction(this.queries)) {
        matchQueries = this.queries(queries)
      } else {
        // Make sure that you have an equal number of keys. We are
        // looping through the passed query params and not the expected values
        // if the user passes fewer query params than expected but all values
        // match this will throw a false positive. Testing that the length of the
        // passed query params is equal to the length of expected keys will prevent
        // us from doing any value checking BEFORE we know if they have all the proper
        // params
        debug('this.queries: %j', this.queries)
        debug('queries: %j', queries)
        if (_.size(this.queries) !== _.size(queries)) {
          matchQueries = false
        } else {
          const self = this
          _.forOwn(queries, function matchOneKeyVal(val, key) {
            const expVal = self.queries[key]
            let isMatch
            if (val === undefined || expVal === undefined) {
              isMatch = false
            } else if (expVal instanceof RegExp) {
              isMatch = common.matchStringOrRegexp(val, expVal)
            } else if (_.isArray(expVal) || _.isObject(expVal)) {
              isMatch = _.isEqual(val, expVal)
            } else {
              isMatch = common.matchStringOrRegexp(val, expVal)
            }
            matchQueries = matchQueries && !!isMatch
          })
        }
        debug('matchQueries: %j', matchQueries)
      }
    }

    // Remove the query string from the path
    if (queryIndex !== -1) {
      path = path.substr(0, queryIndex)
    }
  }

  if (typeof this.uri === 'function') {
    matches =
      matchQueries &&
      method === this.method &&
      common.matchStringOrRegexp(matchKey, this.basePath) &&
      // This is a false positive, as `uri` is not bound to `this`.
      // eslint-disable-next-line no-useless-call
      this.uri.call(this, path)
  } else {
    matches =
      method === this.method &&
      common.matchStringOrRegexp(matchKey, this.basePath) &&
      common.matchStringOrRegexp(path, this.path) &&
      matchQueries
  }

  // special logger for query()
  if (queryIndex !== -1) {
    this.scope.logger(
      `matching ${matchKey}${path}?${queryString} to ${
        this._key
      } with query(${stringify(this.queries)}): ${matches}`
    )
  } else {
    this.scope.logger(`matching ${matchKey}${path} to ${this._key}: ${matches}`)
  }

  if (matches) {
    if (this.scope.transformRequestBodyFunction) {
      body = this.scope.transformRequestBodyFunction(body, this._requestBody)
    }

    matches = matchBody.call(options, this._requestBody, body)
    if (!matches) {
      this.scope.logger("bodies don't match: \n", this._requestBody, '\n', body)
    }
  }

  return matches
}

/**
 * Return true when the interceptor's method, protocol, host, port, and path
 * match the provided options.
 */
Interceptor.prototype.matchAddress = function matchAddress(options) {
  const isRegex = _.isRegExp(this.path)
  const isRegexBasePath = _.isRegExp(this.scope.basePath)

  const method = (options.method || 'GET').toUpperCase()
  let { path } = options
  const { proto } = options

  // NOTE: Do not split off the query params as the regex could use them
  if (!isRegex) {
    path = path ? path.split('?')[0] : ''
  }

  if (this.scope.transformPathFunction) {
    path = this.scope.transformPathFunction(path)
  }
  const comparisonKey = isRegex ? this.__nock_scopeKey : this._key
  const matchKey = `${method} ${proto}://${options.host}${path}`

  if (isRegex && !isRegexBasePath) {
    return !!matchKey.match(comparisonKey) && !!path.match(this.path)
  }

  if (isRegexBasePath) {
    return !!matchKey.match(this.scope.basePath) && !!path.match(this.path)
  }

  return comparisonKey === matchKey
}

Interceptor.prototype.matchHostName = function matchHostName(options) {
  return options.hostname === this.scope.urlParts.hostname
}

Interceptor.prototype.filteringPath = function filteringPath(...args) {
  this.scope.filteringPath(...args)
  return this
}

// filtering by path is valid on the intercept level, but not filtering by request body?

Interceptor.prototype.discard = function discard() {
  if ((this.scope.shouldPersist() || this.counter > 0) && this.filePath) {
    this.body = fs.createReadStream(this.filePath)
    this.body.pause()
  }

  if (!this.scope.shouldPersist() && this.counter < 1) {
    this.scope.remove(this._key, this)
  }
}

Interceptor.prototype.matchHeader = function matchHeader(name, value) {
  this.interceptorMatchHeaders.push({ name, value })
  return this
}

Interceptor.prototype.basicAuth = function basicAuth(options) {
  const username = options['user']
  const password = options['pass'] || ''
  const name = 'authorization'
  const value = `Basic ${Buffer.from(`${username}:${password}`).toString(
    'base64'
  )}`
  this.interceptorMatchHeaders.push({ name, value })
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
Interceptor.prototype.query = function query(queries) {
  if (this.queries !== null) {
    throw Error(`Query parameters have already been already defined`)
  }

  // Allow all query strings to match this route
  if (queries === true) {
    this.queries = queries
    return this
  }

  if (_.isFunction(queries)) {
    this.queries = queries
    return this
  }

  let strFormattingFn
  if (this.scope.scopeOptions.encodedQueryParams) {
    strFormattingFn = common.percentDecode
  }

  if (queries instanceof url.URLSearchParams) {
    // Normalize the data into the shape that is matched against.
    // Duplicate keys are handled by combining the values into an array.
    queries = qs.parse(queries.toString())
  } else if (!_.isPlainObject(queries)) {
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
Interceptor.prototype.times = function times(newCounter) {
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
 * nock('http://zombo.com).get('/').once.reply(200, 'Ok');
 */
Interceptor.prototype.once = function once() {
  return this.times(1)
}

/**
 * An sugar syntax for times(2)
 * @name twice
 * @see {@link times}
 * @public
 * @example
 * nock('http://zombo.com).get('/').twice.reply(200, 'Ok');
 */
Interceptor.prototype.twice = function twice() {
  return this.times(2)
}

/**
 * An sugar syntax for times(3).
 * @name thrice
 * @see {@link times}
 * @public
 * @example
 * nock('http://zombo.com).get('/').thrice.reply(200, 'Ok');
 */
Interceptor.prototype.thrice = function thrice() {
  return this.times(3)
}

/**
 * Delay the response by a certain number of ms.
 *
 * @param {(integer|object)} opts - Number of milliseconds to wait, or an object
 * @param {integer} [opts.head] - Number of milliseconds to wait before response is sent
 * @param {integer} [opts.body] - Number of milliseconds to wait before response body is sent
 * @return {Interceptor} - the current interceptor for chaining
 */
Interceptor.prototype.delay = function delay(opts) {
  let headDelay = 0
  let bodyDelay = 0
  if (_.isNumber(opts)) {
    headDelay = opts
  } else if (_.isObject(opts)) {
    headDelay = opts.head || 0
    bodyDelay = opts.body || 0
  } else {
    throw new Error(`Unexpected input opts ${opts}`)
  }

  return this.delayConnection(headDelay).delayBody(bodyDelay)
}

/**
 * Delay the response body by a certain number of ms.
 *
 * @param {integer} ms - Number of milliseconds to wait before response is sent
 * @return {Interceptor} - the current interceptor for chaining
 */
Interceptor.prototype.delayBody = function delayBody(ms) {
  this.delayInMs += ms
  return this
}

/**
 * Delay the connection by a certain number of ms.
 *
 * @param  {integer} ms - Number of milliseconds to wait
 * @return {Interceptor} - the current interceptor for chaining
 */
Interceptor.prototype.delayConnection = function delayConnection(ms) {
  this.delayConnectionInMs += ms
  return this
}

Interceptor.prototype.getTotalDelay = function getTotalDelay() {
  return this.delayInMs + this.delayConnectionInMs
}

/**
 * Make the socket idle for a certain number of ms (simulated).
 *
 * @param  {integer} ms - Number of milliseconds to wait
 * @return {Interceptor} - the current interceptor for chaining
 */
Interceptor.prototype.socketDelay = function socketDelay(ms) {
  this.socketDelayInMs = ms
  return this
}
