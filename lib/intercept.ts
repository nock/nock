import type { Interceptor } from './interceptor.ts'
import type { Scope } from './scope.ts'
import * as common from './common.ts'
import { intercept as debug } from './debug.ts'
import * as builtinMock from './interceptors/builtin.ts'
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)
let undiciMock: { activate: () => void; deactivate: () => void } | undefined

let allInterceptors: Record<string, any> = {}
let allowNetConnect: RegExp | { test: (url: string) => boolean } | undefined
let _isActive = false

function enableNetConnect(
  matcher?: string | RegExp | ((host: string) => boolean),
) {
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

function isEnabledForNetConnect(url: string) {
  const enabled = !!(allowNetConnect && allowNetConnect.test(url))
  debug('Net connect', enabled ? '' : 'not', 'enabled for', url)
  return enabled
}

function disableNetConnect() {
  allowNetConnect = undefined
}

function isOn() {
  return !isOff()
}

function isOff() {
  return process.env.NOCK_OFF === 'true'
}

function addInterceptor(
  key: string,
  interceptor: Interceptor,
  scope: Scope,
  scopeOptions: Record<string, any>,
  host: string,
) {
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

function remove(interceptor: Interceptor) {
  if (interceptor.__nock_scope?.shouldPersist() || --interceptor.counter > 0) {
    return
  }

  const basePath = interceptor.basePath as string
  const interceptors =
    (allInterceptors[basePath] && allInterceptors[basePath].interceptors) || []

  // TODO: There is a clearer way to write that we want to delete the first
  // matching instance. I'm also not sure why we couldn't delete _all_
  // matching instances.
  interceptors.some(function (thisInterceptor: Interceptor, i: number) {
    return thisInterceptor === interceptor ? interceptors.splice(i, 1) : false
  })
}

function removeAll() {
  Object.keys(allInterceptors).forEach(function (key) {
    allInterceptors[key].interceptors.forEach(function (
      interceptor: Interceptor,
    ) {
      interceptor.scope.keyedInterceptors = {}
    })
  })
  allInterceptors = {}
}

function interceptorsFor(url: URL) {
  debug('interceptors for %j', url.host)

  const port = url.port || (url.protocol === 'https:' ? 443 : 80)
  // Remove brackets from hostname if IPV6
  const basePath = `${url.protocol}//${url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname}:${port}`

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
        interceptors.forEach((ic: Interceptor) => {
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
          })`,
        )
        return interceptors
      }
    }
  }

  return undefined
}

import { Interceptor as InterceptorClass } from './interceptor.ts'

function removeInterceptor(
  options:
    | Interceptor
    | { proto?: string; host?: string; method?: string; path?: string },
) {
  let baseUrl, key, method, proto
  if (options instanceof InterceptorClass) {
    baseUrl = (options as Interceptor).basePath as string
    key = (options as Interceptor)._key
  } else {
    const opts = options as {
      proto?: string
      host?: string
      method?: string
      path?: string
    }
    proto = opts.proto ? opts.proto : 'http'

    common.normalizeRequestOptions(opts)
    baseUrl = `${proto}://${opts.host}`
    method = (opts.method && opts.method.toUpperCase()) || 'GET'
    key = `${method} ${baseUrl}${opts.path || '/'}`
  }

  if (
    allInterceptors[baseUrl] &&
    allInterceptors[baseUrl].interceptors.length > 0
  ) {
    for (let i = 0; i < allInterceptors[baseUrl].interceptors.length; i++) {
      const interceptor = allInterceptors[baseUrl].interceptors[i]
      if (
        options instanceof InterceptorClass
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

function interceptorScopes() {
  const nestedInterceptors = Object.values(allInterceptors).map(
    (i: any) => i.interceptors,
  )
  const scopes = new Set(
    ([] as Interceptor[])
      .concat(...nestedInterceptors)
      .map((i: Interceptor) => i.scope),
  )
  return [...scopes] as Scope[]
}

function isDone() {
  return interceptorScopes().every(scope => scope.isDone())
}

function pendingMocks() {
  return ([] as string[]).concat(
    ...interceptorScopes().map(scope => scope.pendingMocks()),
  )
}

function activeMocks() {
  return ([] as string[]).concat(
    ...interceptorScopes().map(scope => scope.activeMocks()),
  )
}

function activate() {
  if (!_isActive) {
    builtinMock.activate()

    if (!undiciMock) {
      try {
        undiciMock = _require('./interceptors/undici.ts')
      } catch (err: any) {
        if (
          err.code !== 'MODULE_NOT_FOUND' &&
          err.code !== 'ERR_MODULE_NOT_FOUND' &&
          err.code !== 'ERR_REQUIRE_ESM'
        ) {
          throw err
        }
        debug(
          'Undici mocking is disabled because the undici module is not installed',
        )
      }
    }

    undiciMock?.activate()
    _isActive = true
  } else {
    throw new Error('Nock already active')
  }
}

function deactivate() {
  if (_isActive) {
    builtinMock.deactivate()
    undiciMock?.deactivate()
    _isActive = false
  }
}

const isActiveFn = () => _isActive
const abortPendingRequests = common.removeAllTimers

export {
  addInterceptor,
  remove,
  removeAll,
  removeInterceptor,
  isOn,
  activate,
  isActiveFn as isActive,
  isDone,
  pendingMocks,
  activeMocks,
  enableNetConnect,
  disableNetConnect,
  deactivate as restoreOverriddenClientRequest,
  abortPendingRequests,
  interceptorsFor,
  isEnabledForNetConnect,
}
