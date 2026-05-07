import type {
  ReplyBody,
  ReplyHeaders,
  RequestBodyMatcher,
  RequestHeaderMatcher,
} from './interceptor.ts'

export interface Options {
  allowUnmocked?: boolean
  reqheaders?: Record<string, RequestHeaderMatcher>
  badheaders?: string[]
  conditionally?: () => boolean
  filteringScope?: (scope: string) => boolean
  encodedQueryParams?: boolean
}

export interface Definition {
  scope: string | RegExp
  path: string | RegExp
  port?: number | string
  method?: string
  status?: number
  body?: RequestBodyMatcher
  reply?: string
  reqheaders?: Record<string, RequestHeaderMatcher>
  badheaders?: string[]
  rawHeaders?: ReplyHeaders
  response?: ReplyBody
  responseIsBinary?: boolean
  headers?: ReplyHeaders
  options?: Options
}

import fs from 'node:fs'
import { scopeDebuglog } from './debug.ts'
import { addInterceptor, isOn } from './intercept.ts'
import * as common from './common.ts'
import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { Interceptor } from './interceptor.ts'

function normalizeUrl(u: string | URL) {
  if (typeof u === 'string') {
    // If the url is invalid, let the URL library report it
    return normalizeUrl(new URL(u))
  }

  if (!/https?:/.test(u.protocol)) {
    throw new TypeError(
      `Protocol '${u.protocol}' not recognized. This commonly occurs when a hostname and port are included without a protocol, producing a URL that is valid but confusing, and probably not what you want.`,
    )
  }

  return {
    href: u.href,
    origin: u.origin,
    protocol: u.protocol,
    username: u.username,
    password: u.password,
    host: u.host,
    hostname:
      // strip brackets from IPv6
      typeof u.hostname === 'string' && u.hostname.startsWith('[')
        ? u.hostname.slice(1, -1)
        : u.hostname,
    port: u.port || (u.protocol === 'http:' ? 80 : 443),
    pathname: u.pathname,
    search: u.search,
    searchParams: u.searchParams,
    hash: u.hash,
  }
}

class Scope extends EventEmitter {
  /** @internal */
  declare keyedInterceptors: Record<string, Interceptor[]>
  /** @internal */
  declare interceptors: Interceptor[]
  /** @internal */
  declare transformPathFunction: ((path: string) => string) | null
  /** @internal */
  declare transformRequestBodyFunction:
    | ((body: string, requestBody: any) => string)
    | null
  /** @internal */
  declare matchHeaders: { name: string; value: any }[]
  /** @internal */
  declare scopeOptions: Options & Record<string, any>
  /** @internal */
  declare urlParts: Record<string, any>
  /** @internal */
  declare _persist: boolean
  /** @internal */
  declare contentLen: boolean
  /** @internal */
  declare date: Date | null
  /** @internal */
  declare basePath: string | RegExp
  /** @internal */
  declare basePathname: string
  /** @internal */
  declare port: any
  /** @internal */
  declare _defaultReplyHeaders: any[]
  /** @internal */
  declare logger: (...args: any[]) => void

  constructor(basePath: string | RegExp | URL, options?: Options) {
    super()

    this.keyedInterceptors = {}
    this.interceptors = []
    this.transformPathFunction = null
    this.transformRequestBodyFunction = null
    this.matchHeaders = []
    this.scopeOptions = options || {}
    this.urlParts = {}
    this._persist = false
    this.contentLen = false
    this.date = null
    this.basePath = basePath as string | RegExp
    this.basePathname = ''
    this.port = null
    this._defaultReplyHeaders = []

    let logNamespace = String(basePath)

    if (!(basePath instanceof RegExp)) {
      this.urlParts = normalizeUrl(basePath as string | URL)
      this.port = this.urlParts.port
      this.basePathname = this.urlParts.pathname.replace(/\/$/, '')
      this.basePath = `${this.urlParts.protocol}//${this.urlParts.hostname}:${this.port}`
      logNamespace = this.urlParts.host
    }

    this.logger = scopeDebuglog(logNamespace)
  }

  add(key: string, interceptor: Interceptor) {
    if (!(key in this.keyedInterceptors)) {
      this.keyedInterceptors[key] = []
    }
    this.keyedInterceptors[key].push(interceptor)
    addInterceptor(
      this.basePath as string,
      interceptor,
      this,
      this.scopeOptions,
      this.urlParts.hostname as string,
    )
  }

  remove(key: string, interceptor: Interceptor) {
    if (this._persist) {
      return
    }
    const arr = this.keyedInterceptors[key]
    if (arr) {
      arr.splice(arr.indexOf(interceptor), 1)
      if (arr.length === 0) {
        delete this.keyedInterceptors[key]
      }
    }
  }

  intercept(
    uri: string | RegExp | ((path: string) => boolean),
    method: string,
    requestBody?: RequestBodyMatcher,
    interceptorOptions?: Options,
  ): Interceptor {
    const ic = new Interceptor(
      this,
      uri,
      method,
      requestBody,
      interceptorOptions,
    )

    this.interceptors.push(ic)
    return ic
  }

  get(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'GET', requestBody, options)
  }

  post(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'POST', requestBody, options)
  }

  put(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'PUT', requestBody, options)
  }

  head(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'HEAD', requestBody, options)
  }

  patch(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'PATCH', requestBody, options)
  }

  merge(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'MERGE', requestBody, options)
  }

  delete(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'DELETE', requestBody, options)
  }

  options(
    uri: string | RegExp | ((path: string) => boolean),
    requestBody?: RequestBodyMatcher,
    options?: Options,
  ): Interceptor {
    return this.intercept(uri, 'OPTIONS', requestBody, options)
  }

  // Returns the list of keys for non-optional Interceptors that haven't been completed yet.
  pendingMocks() {
    return this.activeMocks().filter((key: string) =>
      this.keyedInterceptors[key].some(
        ({ interceptionCounter, optional }: Interceptor) => {
          const persistedAndUsed = this._persist && interceptionCounter > 0
          return !persistedAndUsed && !optional
        },
      ),
    )
  }

  // Returns all keyedInterceptors that are active.
  activeMocks() {
    return Object.keys(this.keyedInterceptors)
  }

  isDone() {
    if (!isOn()) {
      return true
    }

    return this.pendingMocks().length === 0
  }

  done() {
    assert.ok(
      this.isDone(),
      `Mocks not yet satisfied:\n${this.pendingMocks().join('\n')}`,
    )
  }

  buildFilter() {
    const filteringArguments = Array.from(arguments) as any[]

    if (arguments[0] instanceof RegExp) {
      return function (candidate: string) {
        /* istanbul ignore if */
        if (typeof candidate !== 'string') {
          throw Error(
            `Nock internal assertion failed: typeof candidate is ${typeof candidate}. If you encounter this error, please report it as a bug.`,
          )
        }
        return candidate.replace(filteringArguments[0], filteringArguments[1])
      }
    } else if (typeof arguments[0] === 'function') {
      return arguments[0]
    }
  }

  filteringPath() {
    this.transformPathFunction = this.buildFilter.apply(this, arguments as any)
    if (!this.transformPathFunction) {
      throw new Error(
        'Invalid arguments: filtering path should be a function or a regular expression',
      )
    }
    return this
  }

  filteringRequestBody() {
    this.transformRequestBodyFunction = this.buildFilter.apply(
      this,
      arguments as any,
    )
    if (!this.transformRequestBodyFunction) {
      throw new Error(
        'Invalid arguments: filtering request body should be a function or a regular expression',
      )
    }
    return this
  }

  matchHeader(name: string, value: RequestHeaderMatcher) {
    //  We use lower-case header field names throughout Nock.
    this.matchHeaders.push({ name: name.toLowerCase(), value })
    return this
  }

  defaultReplyHeaders(headers: ReplyHeaders) {
    this._defaultReplyHeaders = common.headersInputToRawArray(headers)
    return this
  }

  persist(flag = true) {
    if (typeof flag !== 'boolean') {
      throw new Error('Invalid arguments: argument should be a boolean')
    }
    this._persist = flag
    return this
  }

  shouldPersist() {
    return this._persist
  }

  replyContentLength() {
    this.contentLen = true
    return this
  }

  replyDate(d?: Date) {
    this.date = d || new Date()
    return this
  }

  clone() {
    return new Scope(this.basePath, this.scopeOptions)
  }
}

function loadDefs(path: string) {
  if (!fs) {
    throw new Error('No fs')
  }

  const contents = fs.readFileSync(path) as unknown as string
  return JSON.parse(contents)
}

function load(path: string) {
  return define(loadDefs(path))
}

function getStatusFromDefinition(nockDef: Record<string, any>) {
  // Backward compatibility for when `status` was encoded as string in `reply`.
  if (nockDef.reply !== undefined) {
    const parsedReply = parseInt(nockDef.reply, 10)
    if (isNaN(parsedReply)) {
      throw Error('`reply`, when present, must be a numeric string')
    }

    return parsedReply
  }

  const DEFAULT_STATUS_OK = 200
  return nockDef.status || DEFAULT_STATUS_OK
}

function getScopeFromDefinition(nockDef: Record<string, any>) {
  //  Backward compatibility for when `port` was part of definition.
  if (nockDef.port !== undefined) {
    //  Include `port` into scope if it doesn't exist.
    const url = URL.parse(nockDef.scope) as any

    if (url.port === '') {
      return `${nockDef.scope}:${nockDef.port}`
    } else {
      if (parseInt(url.port) !== parseInt(nockDef.port)) {
        throw new Error(
          'Mismatched port numbers in scope and port properties of nock definition.',
        )
      }
    }
  }

  return nockDef.scope
}

function tryJsonParse(string: string) {
  try {
    return JSON.parse(string)
  } catch {
    return string
  }
}

function define(nockDefs: Record<string, any>[]) {
  const scopes: Scope[] = []

  nockDefs.forEach(function (nockDef: Record<string, any>) {
    const nscope = getScopeFromDefinition(nockDef)
    const npath = nockDef.path
    if (!nockDef.method) {
      throw Error('Method is required')
    }
    const method = nockDef.method.toLowerCase()
    const status = getStatusFromDefinition(nockDef)
    const rawHeaders = nockDef.rawHeaders || []
    const reqheaders = nockDef.reqheaders || {}
    const badheaders = nockDef.badheaders || []
    const options = { ...nockDef.options }

    //  We use request headers for both filtering (see below) and mocking.
    //  Here we are setting up mocked request headers but we don't want to
    //  be changing the user's options object so we clone it first.
    options.reqheaders = reqheaders
    options.badheaders = badheaders

    // Response is not always JSON as it could be a string or binary data or
    // even an array of binary buffers (e.g. when content is encoded).
    let response
    if (!nockDef.response) {
      response = ''
      // TODO: Rename `responseIsBinary` to `responseIsUtf8Representable`.
    } else if (nockDef.responseIsBinary) {
      response = Buffer.from(nockDef.response, 'hex')
    } else {
      response =
        typeof nockDef.response === 'string'
          ? tryJsonParse(nockDef.response)
          : nockDef.response
    }

    const scope = new Scope(nscope, options)

    // If request headers were specified filter by them.
    Object.entries(reqheaders).forEach(([fieldName, value]) => {
      scope.matchHeader(fieldName, value as RequestHeaderMatcher)
    })

    const acceptableFilters = ['filteringRequestBody', 'filteringPath']
    acceptableFilters.forEach(filter => {
      if (nockDef[filter]) {
        ;(scope as any)[filter](nockDef[filter])
      }
    })

    scope
      .intercept(npath, method, nockDef.body)
      .reply(status, response, rawHeaders)

    scopes.push(scope)
  })

  return scopes
}

export { Scope, load, loadDefs, define }
