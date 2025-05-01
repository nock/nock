'use strict'

const http = require('node:http')
const { inherits } = require('node:util')
const { BatchInterceptor, InterceptorReadyState, getRawRequest } = require('@mswjs/interceptors')
const {
  default: nodeInterceptors,
} = require('@mswjs/interceptors/presets/node')
const common = require('./common')
const { intercept: debug } = require('./debug')
const globalEmitter = require('./global_emitter')
const { playbackInterceptor } = require('./playback_interceptor')
const { arrayBuffer } = require('stream/consumers')

const interceptor = new BatchInterceptor({
  name: 'nock-interceptor',
  interceptors: nodeInterceptors,
})

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

function isEnabledForNetConnect(url) {
  const enabled = allowNetConnect && allowNetConnect.test(url)
  debug('Net connect', enabled ? '' : 'not', 'enabled for', url)
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
 * @param {URL} url 
 * @returns {Interceptor[]}
 */
function interceptorsFor(url) {
  debug('interceptors for %j', url.host)

  const port = url.port || (url.protocol === 'https:' ? 443 : 80)
  // TODO: Why we strip the brackets from ipv6?
  // Remove brackets from hostname if IPV6
  const basePath = `${url.protocol}//${url.hostname.startsWith('[') ? url.hostname.slice(1, -1): url.hostname}:${port}`

  debug('filtering interceptors for basepath', basePath)

  // First try to use filteringScope if any of the interceptors has it defined.
  for (const { key, interceptors, allowUnmocked } of Object.values(
    allInterceptors,
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
          `matched base path (${interceptors.length} interceptor${interceptors.length > 1 ? 's' : ''
          })`,
        )
        return interceptors
      }
    }
  }

  return undefined
}

function removeInterceptor(options) {
  // Lazily import to avoid circular imports.
  const Interceptor = require('./interceptor')

  let baseUrl, key, method, proto
  if (options instanceof Interceptor) {
    baseUrl = options.basePath
    key = options._key
  } else {
    proto = options.proto ? options.proto : 'http'

    common.normalizeRequestOptions(options)
    baseUrl = `${proto}://${options.host}`
    method = (options.method && options.method.toUpperCase()) || 'GET'
    key = `${method} ${baseUrl}${options.path || '/'}`
  }

  if (
    allInterceptors[baseUrl] &&
    allInterceptors[baseUrl].interceptors.length > 0
  ) {
    for (let i = 0; i < allInterceptors[baseUrl].interceptors.length; i++) {
      const interceptor = allInterceptors[baseUrl].interceptors[i]
      if (
        options instanceof Interceptor
          ? interceptor === options
          : interceptor._key === key
      ) {
        allInterceptors[baseUrl].interceptors.splice(i, 1)
        interceptor.scope.remove(key, interceptor)
        break
      }
    }

    return true
  }

  return false
}

function restoreOverriddenClientRequest() {
  debug('restoring overridden ClientRequest')

  if (interceptor.readyState === InterceptorReadyState.INACTIVE) {
    debug('- ClientRequest was not overridden')
  } else {
    interceptor.dispose()
    debug('- ClientRequest restored')
  }
}

function isActive() {
  return interceptor.readyState === InterceptorReadyState.APPLIED
}

function interceptorScopes() {
  const nestedInterceptors = Object.values(allInterceptors).map(
    i => i.interceptors,
  )
  const scopes = new Set([].concat(...nestedInterceptors).map(i => i.scope))
  return [...scopes]
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
  if (interceptor.readyState === InterceptorReadyState.APPLIED) {
    throw new Error('Nock already active')
  }

  interceptor.apply()

  // Force msw to forward Nock's error instead of coerce it into 500 error
  interceptor.on('unhandledException', ({ controller, error }) => {
    controller.errorWith(error)
  })
  interceptor.on('request', async function ({ request: mswRequest, controller }) {
      const request = mswRequest.clone()
      const url = new URL(request.url)
      const interceptors = interceptorsFor(url)

      if (isOn() && interceptors) {
        const matches = interceptors.some(interceptor =>
          interceptor.matchOrigin(request),
        )
        const allowUnmocked = interceptors.some(
          interceptor => interceptor.options.allowUnmocked,
        )
        if (!matches && allowUnmocked) {
          globalEmitter.emit('no match', request)
        } else {
          const rawRequest = getRawRequest(mswRequest)
          // If this is GET request with body, we need to read the body from the socket because Fetch API doesn't support this.
          const requestBodyBuffer =
            rawRequest instanceof http.ClientRequest &&
            rawRequest.method === 'GET' &&
            rawRequest.getHeader('content-length') > 0
              ? // TODO: use getClientRequestBodyStream instead of access to internal properties
                await arrayBuffer(rawRequest.socket.requestStream)
              : await request.arrayBuffer()
          // When request body is a binary buffer we internally use in its hexadecimal representation.
          const requestBodyIsUtf8Representable = common.isUtf8Representable(Buffer.from(requestBodyBuffer))
          const requestBodyString = new TextDecoder(
            requestBodyIsUtf8Representable ? 'utf8' : 'hex',
          ).decode(requestBodyBuffer)
          const matchedInterceptor = interceptors.find(i =>
            i.match(request, requestBodyString),
          )

          if (matchedInterceptor) {
            matchedInterceptor.scope.logger(
              'interceptor identified, starting mocking',
            )

            matchedInterceptor.markConsumed()

           const response = await playbackInterceptor({
              request,
              requestBodyString,
              requestBodyIsUtf8Representable,
              interceptor: matchedInterceptor,
            })

            controller.respondWith(response)
          } else {
            globalEmitter.emit('no match', request)

            // Try to find a hostname match that allows unmocked.
            const allowUnmocked = interceptors.some(
              i => i.matchHostName(url.hostname) && i.options.allowUnmocked,
            )

            if (!allowUnmocked) {
              const reqStr = common.stringifyRequest(request, requestBodyString)
              const err = new Error(`Nock: No match for request ${reqStr}`)
              err.code = 'ERR_NOCK_NO_MATCH'
              err.statusCode = err.status = 404
              throw err
            }
          }
        }
      } else {
        globalEmitter.emit('no match', request)
        // Remove http(s):// for backward compatibility until we decide this Error.
        const normalizedUrl = common.normalizeOrigin(url).replace(`${url.protocol}//`, '')
        if (!(isOff() || isEnabledForNetConnect(normalizedUrl))) {
          throw new NetConnectNotAllowedError(normalizedUrl, url.pathname)
        }
      }
    },
  )
}

module.exports = {
  addInterceptor,
  remove,
  removeAll,
  removeInterceptor,
  isOn,
  activate,
  isActive,
  isDone,
  pendingMocks,
  activeMocks,
  enableNetConnect,
  disableNetConnect,
  restoreOverriddenClientRequest,
  abortPendingRequests: common.removeAllTimers,
}
