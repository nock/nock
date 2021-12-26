'use strict'

/**
 * @module nock/intercept
 */

const { playbackInterceptor } = require('./playback_interceptor')
const common = require('./common')
const { inherits } = require('util')
const debug = require('debug')('nock.intercept')
const globalEmitter = require('./global_emitter')
const recorder = require('./recorder')

const intercept = require('../modules/intercept-node-http')

//  Variable where we keep the reset function to restore the overridden `http(s)` APIs
let resetIntercept

/**
 * @name NetConnectNotAllowedError
 * @private
 * @desc Error trying to make a connection when disabled external access.
 * @class
 * @example
 * nock.disableNetConnect();
 * http.get('http://zombo.com');
 * // throw NetConnectNotAllowedError
 */
function NetConnectNotAllowedError(host, path) {
  Error.call(this)

  this.name = 'NetConnectNotAllowedError'
  this.code = 'ENETUNREACH'
  this.message = `Nock: Disallowed net connect for "${host}${path}"`

  Error.captureStackTrace(this, this.constructor)
}

inherits(NetConnectNotAllowedError, Error)

let allInterceptors = {}
let allowNetConnect

/**
 * Enabled real request.
 * @public
 * @param {String|RegExp} matcher=RegExp.new('.*') Expression to match
 * @example
 * // Enables all real requests
 * nock.enableNetConnect();
 * @example
 * // Enables real requests for url that matches google
 * nock.enableNetConnect('google');
 * @example
 * // Enables real requests for url that matches google and amazon
 * nock.enableNetConnect(/(google|amazon)/);
 * @example
 * // Enables real requests for url that includes google
 * nock.enableNetConnect(host => host.includes('google'));
 */
function enableNetConnect(matcher) {
  if (typeof matcher === 'string') {
    allowNetConnect = new RegExp(matcher)
  } else if (matcher instanceof RegExp) {
    allowNetConnect = matcher
  } else if (typeof matcher === 'function') {
    allowNetConnect = { test: matcher }
  } else {
    allowNetConnect = /.*/
  }
}

function isEnabledForNetConnect(options) {
  common.normalizeRequestOptions(options)

  const enabled = allowNetConnect && allowNetConnect.test(options.host)
  debug('Net connect', enabled ? '' : 'not', 'enabled for', options.host)
  return enabled
}

/**
 * Disable all real requests.
 * @public
 * @example
 * nock.disableNetConnect();
 */
function disableNetConnect() {
  allowNetConnect = undefined
}

function isOn() {
  return !isOff()
}

function isOff() {
  return process.env.NOCK_OFF === 'true'
}

function addInterceptor(key, interceptor, scope, scopeOptions, host) {
  if (!(key in allInterceptors)) {
    allInterceptors[key] = { key, interceptors: [] }
  }
  interceptor.__nock_scope = scope

  //  We need scope's key and scope options for scope filtering function (if defined)
  interceptor.__nock_scopeKey = key
  interceptor.__nock_scopeOptions = scopeOptions
  //  We need scope's host for setting correct request headers for filtered scopes.
  interceptor.__nock_scopeHost = host
  interceptor.interceptionCounter = 0

  if (scopeOptions.allowUnmocked) allInterceptors[key].allowUnmocked = true

  allInterceptors[key].interceptors.push(interceptor)
}

function remove(interceptor) {
  if (interceptor.__nock_scope.shouldPersist() || --interceptor.counter > 0) {
    return
  }

  const { basePath } = interceptor
  const interceptors =
    (allInterceptors[basePath] && allInterceptors[basePath].interceptors) || []

  // TODO: There is a clearer way to write that we want to delete the first
  // matching instance. I'm also not sure why we couldn't delete _all_
  // matching instances.
  interceptors.some(function (thisInterceptor, i) {
    return thisInterceptor === interceptor ? interceptors.splice(i, 1) : false
  })
}

function removeAll() {
  Object.keys(allInterceptors).forEach(function (key) {
    allInterceptors[key].interceptors.forEach(function (interceptor) {
      interceptor.scope.keyedInterceptors = {}
    })
  })
  allInterceptors = {}
}

/**
 * Return all the Interceptors whose Scopes match against the base path of the provided options.
 *
 * @returns {Interceptor[]}
 */
function interceptorsFor(options) {
  common.normalizeRequestOptions(options)

  debug('interceptors for %j', options.host)

  const basePath = `${options.protocol}//${options.host}`

  debug('filtering interceptors for basepath', basePath)

  // First try to use filteringScope if any of the interceptors has it defined.
  for (const { key, interceptors, allowUnmocked } of Object.values(
    allInterceptors
  )) {
    for (const interceptor of interceptors) {
      const { filteringScope } = interceptor.__nock_scopeOptions

      // If scope filtering function is defined and returns a truthy value then
      // we have to treat this as a match.
      if (filteringScope && filteringScope(basePath)) {
        interceptor.scope.logger('found matching scope interceptor')

        // Keep the filtered scope (its key) to signal the rest of the module
        // that this wasn't an exact but filtered match.
        interceptors.forEach(ic => {
          ic.__nock_filteredScope = ic.__nock_scopeKey
        })
        return interceptors
      }
    }

    if (common.matchStringOrRegexp(basePath, key)) {
      if (allowUnmocked && interceptors.length === 0) {
        debug('matched base path with allowUnmocked (no matching interceptors)')
        return [
          {
            options: { allowUnmocked: true },
            matchOrigin() {
              return false
            },
          },
        ]
      } else {
        debug(
          `matched base path (${interceptors.length} interceptor${
            interceptors.length > 1 ? 's' : ''
          })`
        )
        return interceptors
      }
    }
  }
}

function removeInterceptor(options) {
  // Lazily import to avoid circular imports.
  const Interceptor = require('./interceptor')

  let baseUrl, key, method, protocol
  if (options instanceof Interceptor) {
    baseUrl = options.basePath
    key = options._key
  } else {
    /* istanbul ignore if - deprecated */
    if (!options.protocol && options.proto) {
      console.warn(
        'nock: options.proto is deprecated. Use options.protocol instead.'
      )
      options.protocol =
        options.proto === 'http'
          ? 'http:'
          : options.proto === 'https'
          ? 'https:'
          : options.protocol
    }
    protocol = options.protocol ? options.protocol : 'http:'

    common.normalizeRequestOptions(options)
    baseUrl = `${protocol}//${options.host}`
    method = (options.method && options.method.toUpperCase()) || 'GET'
    key = `${method} ${baseUrl}${options.path || '/'}`
  }

  if (
    allInterceptors[baseUrl] &&
    allInterceptors[baseUrl].interceptors.length > 0
  ) {
    for (let i = 0; i < allInterceptors[baseUrl].interceptors.length; i++) {
      const interceptor = allInterceptors[baseUrl].interceptors[i]
      if (interceptor._key === key) {
        allInterceptors[baseUrl].interceptors.splice(i, 1)
        interceptor.scope.remove(key, interceptor)
        break
      }
    }

    return true
  }

  return false
}

function isActive() {
  return Boolean(resetIntercept)
}

function interceptorScopes() {
  const nestedInterceptors = Object.values(allInterceptors).map(
    i => i.interceptors
  )
  return [].concat(...nestedInterceptors).map(i => i.scope)
}

function isDone() {
  return interceptorScopes().every(scope => scope.isDone())
}

function pendingMocks() {
  return [].concat(...interceptorScopes().map(scope => scope.pendingMocks()))
}

function activeMocks() {
  return [].concat(...interceptorScopes().map(scope => scope.activeMocks()))
}

function activate() {
  if (resetIntercept) {
    throw new Error('Nock already active')
  }

  resetIntercept = intercept((options, overriddenRequest) => {
    const interceptors = interceptorsFor(options)

    if (isOn() && interceptors) {
      const matches = interceptors.some(interceptor =>
        interceptor.matchOrigin(options)
      )
      const allowUnmocked = interceptors.some(
        interceptor => interceptor.options.allowUnmocked
      )

      if (!matches && allowUnmocked) {
        globalEmitter.emit('no match', overriddenRequest)

        return overriddenRequest.nockSendRealRequest()
      }

      debug('using', interceptors.length, 'interceptors')

      // We need to override the host header in case the `filteringScope` option is used.
      //
      // Example:
      //
      // ```js
      // const scope = nock('https://api.dropbox.com', {
      //   filteringScope: scope => /^https:\/\/api[0-9]*.dropbox.com/.test(scope),
      // })
      //   .get('/1/metadata/auto/Photos?include_deleted=false&list=true')
      //   .reply(200)
      // ```
      //
      // In the above example we want to match requests to any subdomain of `dropbox.com` matching `/api[0-9]*/`.
      // But in the actual request, it should look as if the request went to `api.dropbox.com` as defined in the scope.
      //
      // I guess this is for making work better with recording. ~@gr2m
      interceptors.forEach(interceptor => {
        setHostHeaderUsingInterceptor(options, overriddenRequest, interceptor)
      })

      const requestBodyBuffer = Buffer.concat(
        overriddenRequest.nockGetRequestBodyChunks()
      )
      // When request body is a binary buffer we internally use in its hexadecimal
      // representation.
      const requestBodyIsUtf8Representable =
        common.isUtf8Representable(requestBodyBuffer)
      const requestBodyString = requestBodyBuffer.toString(
        requestBodyIsUtf8Representable ? 'utf8' : 'hex'
      )

      const matchedInterceptor = interceptors.find(i =>
        i.match(overriddenRequest, options, requestBodyString)
      )

      if (matchedInterceptor) {
        matchedInterceptor.scope.logger(
          'interceptor identified, starting mocking'
        )

        matchedInterceptor.markConsumed()

        playbackInterceptor({
          req: overriddenRequest,
          requestBodyString,
          requestBodyIsUtf8Representable,
          interceptor: matchedInterceptor,
        })

        return
      }

      globalEmitter.emit(
        'no match',
        overriddenRequest,
        options,
        requestBodyString
      )

      // Try to find a hostname match that allows unmocked.
      const allowUnmockedForHostName = interceptors.some(
        i => i.matchHostName(options) && i.options.allowUnmocked
      )

      if (allowUnmockedForHostName) {
        return overriddenRequest.nockSendRealRequest()
      }

      const reqStr = common.stringifyRequest(options, requestBodyString)
      const err = new Error(`Nock: No match for request ${reqStr}`)
      err.code = 'ERR_NOCK_NO_MATCH'
      err.statusCode = err.status = 404
      return overriddenRequest.destroy(err)
    }

    if (isOff() || isEnabledForNetConnect(options)) {
      overriddenRequest.nockSendRealRequest()

      overriddenRequest.once('close', () => {
        globalEmitter.emit('no match', options)
      })
      return
    }

    globalEmitter.emit('no match', options)

    overriddenRequest.socket._hadError = true
    const error = new NetConnectNotAllowedError(options.host, options.path)
    overriddenRequest.emit('error', error)
  })
}

function restore() {
  recorder.restore()

  if (!resetIntercept) return

  resetIntercept()
  resetIntercept = null
}

/**
 * Set request headers of the given request. This is needed both during the
 * routing phase, in case header filters were specified, and during the
 * interceptor-playback phase, to correctly pass mocked request headers.
 */
function setHostHeaderUsingInterceptor(options, request, interceptor) {
  // If a filtered scope is being used we have to use scope's host in the
  // header, otherwise 'host' header won't match.
  // NOTE: We use lower-case header field names throughout Nock.
  const HOST_HEADER = 'host'
  if (interceptor.__nock_filteredScope && interceptor.__nock_scopeHost) {
    options.headers[HOST_HEADER] = interceptor.__nock_scopeHost
    request.setHeader(HOST_HEADER, interceptor.__nock_scopeHost)
  }
}

module.exports = {
  addInterceptor,
  remove,
  removeAll,
  removeInterceptor,
  isOn,
  activate,
  restore,
  isActive,
  isDone,
  pendingMocks,
  activeMocks,
  enableNetConnect,
  disableNetConnect,
  abortPendingRequests: common.removeAllTimers,
}
