'use strict'

/**
 * @module nock/scope
 */
const globalIntercept = require('./intercept')
const common = require('./common')
const assert = require('assert')
const url = require('url')
const _ = require('lodash')
const debug = require('debug')('nock.scope')
const { EventEmitter } = require('events')
const globalEmitter = require('./global_emitter')
const util = require('util')
const Interceptor = require('./interceptor')

let fs

try {
  fs = require('fs')
} catch (err) {
  // do nothing, we're in the browser
}

function startScope(basePath, options) {
  return new Scope(basePath, options)
}

function Scope(basePath, options) {
  EventEmitter.apply(this)
  this.keyedInterceptors = {}
  this.interceptors = []
  this.transformPathFunction = null
  this.transformRequestBodyFunction = null
  this.matchHeaders = []
  this.logger = debug
  this.scopeOptions = options || {}
  this.urlParts = {}
  this._persist = false
  this.contentLen = false
  this.date = null
  this.basePath = basePath
  this.basePathname = ''
  this.port = null

  if (!(basePath instanceof RegExp)) {
    this.urlParts = url.parse(basePath)
    this.port =
      this.urlParts.port || (this.urlParts.protocol === 'http:' ? 80 : 443)
    this.basePathname = this.urlParts.pathname.replace(/\/$/, '')
    this.basePath = `${this.urlParts.protocol}//${this.urlParts.hostname}:${
      this.port
    }`
  }
}

util.inherits(Scope, EventEmitter)

Scope.prototype.add = function add(key, interceptor, scope) {
  if (!this.keyedInterceptors.hasOwnProperty(key)) {
    this.keyedInterceptors[key] = []
  }
  this.keyedInterceptors[key].push(interceptor)
  globalIntercept(
    this.basePath,
    interceptor,
    this,
    this.scopeOptions,
    this.urlParts.hostname
  )
}

Scope.prototype.remove = function remove(key, interceptor) {
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

Scope.prototype.intercept = function intercept(
  uri,
  method,
  requestBody,
  interceptorOptions
) {
  const ic = new Interceptor(this, uri, method, requestBody, interceptorOptions)

  this.interceptors.push(ic)
  return ic
}

Scope.prototype.get = function get(uri, requestBody, options) {
  return this.intercept(uri, 'GET', requestBody, options)
}

Scope.prototype.post = function post(uri, requestBody, options) {
  return this.intercept(uri, 'POST', requestBody, options)
}

Scope.prototype.put = function put(uri, requestBody, options) {
  return this.intercept(uri, 'PUT', requestBody, options)
}

Scope.prototype.head = function head(uri, requestBody, options) {
  return this.intercept(uri, 'HEAD', requestBody, options)
}

Scope.prototype.patch = function patch(uri, requestBody, options) {
  return this.intercept(uri, 'PATCH', requestBody, options)
}

Scope.prototype.merge = function merge(uri, requestBody, options) {
  return this.intercept(uri, 'MERGE', requestBody, options)
}

Scope.prototype.delete = function _delete(uri, requestBody, options) {
  return this.intercept(uri, 'DELETE', requestBody, options)
}

Scope.prototype.options = function _options(uri, requestBody, options) {
  return this.intercept(uri, 'OPTIONS', requestBody, options)
}

Scope.prototype.pendingMocks = function pendingMocks() {
  const self = this

  const pendingInterceptorKeys = Object.keys(this.keyedInterceptors).filter(
    function(key) {
      const interceptorList = self.keyedInterceptors[key]
      const pendingInterceptors = interceptorList.filter(function(interceptor) {
        // TODO: This assumes that completed mocks are removed from the keyedInterceptors list
        // (when persistence is off). We should change that (and this) in future.
        const persistedAndUsed =
          self._persist && interceptor.interceptionCounter > 0
        return !persistedAndUsed && !interceptor.optional
      })
      return pendingInterceptors.length > 0
    }
  )

  return pendingInterceptorKeys
}

// Returns all keyedInterceptors that are active.
// This incomplete interceptors, persisted but complete interceptors, and
// optional interceptors, but not non-persisted and completed interceptors.
Scope.prototype.activeMocks = function activeMocks() {
  return Object.keys(this.keyedInterceptors)
}

Scope.prototype.isDone = function isDone() {
  // if nock is turned off, it always says it's done
  if (!globalIntercept.isOn()) {
    return true
  }

  return this.pendingMocks().length === 0
}

Scope.prototype.done = function done() {
  assert.ok(
    this.isDone(),
    `Mocks not yet satisfied:\n${this.pendingMocks().join('\n')}`
  )
}

Scope.prototype.buildFilter = function buildFilter() {
  const filteringArguments = arguments

  if (arguments[0] instanceof RegExp) {
    return function(candidate) {
      /* istanbul ignore if */
      if (typeof candidate !== 'string') {
        // Given the way nock is written, it seems like `candidate` will always
        // be a string, regardless of what options might be passed to it.
        // However the code used to contain a truthiness test of `candidate`.
        // The check is being preserved for now.
        throw Error(
          `Nock internal assertion failed: typeof candidate is ${typeof candidate}. If you encounter this error, please report it as a bug.`
        )
      }
      return candidate.replace(filteringArguments[0], filteringArguments[1])
    }
  } else if (_.isFunction(arguments[0])) {
    return arguments[0]
  }
}

Scope.prototype.filteringPath = function filteringPath() {
  this.transformPathFunction = this.buildFilter.apply(this, arguments)
  if (!this.transformPathFunction) {
    throw new Error(
      'Invalid arguments: filtering path should be a function or a regular expression'
    )
  }
  return this
}

Scope.prototype.filteringRequestBody = function filteringRequestBody() {
  this.transformRequestBodyFunction = this.buildFilter.apply(this, arguments)
  if (!this.transformRequestBodyFunction) {
    throw new Error(
      'Invalid arguments: filtering request body should be a function or a regular expression'
    )
  }
  return this
}

Scope.prototype.matchHeader = function matchHeader(name, value) {
  //  We use lower-case header field names throughout Nock.
  this.matchHeaders.push({ name: name.toLowerCase(), value })
  return this
}

Scope.prototype.defaultReplyHeaders = function defaultReplyHeaders(headers) {
  // Because these are lower-cased, res.rawHeaders can have the wrong keys.
  // https://github.com/nock/nock/issues/1553
  this._defaultReplyHeaders = common.headersFieldNamesToLowerCase(headers)
  return this
}

Scope.prototype.log = function log(newLogger) {
  this.logger = newLogger
  return this
}

Scope.prototype.persist = function persist(flag) {
  this._persist = flag == null ? true : flag
  if (typeof this._persist !== 'boolean') {
    throw new Error('Invalid arguments: argument should be a boolean')
  }
  return this
}

Scope.prototype.shouldPersist = function shouldPersist() {
  return this._persist
}

Scope.prototype.replyContentLength = function replyContentLength() {
  this.contentLen = true
  return this
}

Scope.prototype.replyDate = function replyDate(d) {
  this.date = d || new Date()
  return this
}

function cleanAll() {
  globalIntercept.removeAll()
  return module.exports
}

function loadDefs(path) {
  if (!fs) {
    throw new Error('No fs')
  }

  const contents = fs.readFileSync(path)
  return JSON.parse(contents)
}

function load(path) {
  return define(loadDefs(path))
}

function getStatusFromDefinition(nockDef) {
  // Backward compatibility for when `status` was encoded as string in `reply`.
  if (!_.isUndefined(nockDef.reply)) {
    const parsedReply = parseInt(nockDef.reply, 10)
    if (isNaN(parsedReply)) {
      throw Error('`reply`, when present, must be a numeric string')
    }

    return parsedReply
  }

  const DEFAULT_STATUS_OK = 200
  return nockDef.status || DEFAULT_STATUS_OK
}

function getScopeFromDefinition(nockDef) {
  //  Backward compatibility for when `port` was part of definition.
  if (!_.isUndefined(nockDef.port)) {
    //  Include `port` into scope if it doesn't exist.
    const options = url.parse(nockDef.scope)
    if (_.isNull(options.port)) {
      return `${nockDef.scope}:${nockDef.port}`
    } else {
      if (parseInt(options.port) !== parseInt(nockDef.port)) {
        throw new Error(
          'Mismatched port numbers in scope and port properties of nock definition.'
        )
      }
    }
  }

  return nockDef.scope
}

function tryJsonParse(string) {
  try {
    return JSON.parse(string)
  } catch (err) {
    return string
  }
}

function define(nockDefs) {
  const nocks = []

  nockDefs.forEach(function(nockDef) {
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
    const body = nockDef.body || ''
    const options = { ...nockDef.options }

    //  We use request headers for both filtering (see below) and mocking.
    //  Here we are setting up mocked request headers but we don't want to
    //  be changing the user's options object so we clone it first.
    options.reqheaders = reqheaders
    options.badheaders = badheaders

    //  Response is not always JSON as it could be a string or binary data or
    //  even an array of binary buffers (e.g. when content is encoded)
    let response
    if (!nockDef.response) {
      response = ''
    } else if (nockDef.responseIsBinary) {
      response = Buffer.from(nockDef.response, 'hex')
    } else {
      response = _.isString(nockDef.response)
        ? tryJsonParse(nockDef.response)
        : nockDef.response
    }

    let nock
    // TODO-coverage: Find out what `body === '*'` means. Add a comment here
    // explaining it, and a test case if necessary. Also, update the readme
    // example of `filteringRequestBody()` because it doesn't explain what the
    // `*` really means.
    if (body === '*') {
      nock = startScope(nscope, options)
        .filteringRequestBody(function() {
          return '*'
        })
        [method](npath, '*')
        .reply(status, response, rawHeaders)
    } else {
      nock = startScope(nscope, options)
      //  If request headers were specified filter by them.
      if (_.size(reqheaders) > 0) {
        for (const k in reqheaders) {
          nock.matchHeader(k, reqheaders[k])
        }
      }
      const acceptableFilters = ['filteringRequestBody', 'filteringPath']
      acceptableFilters.forEach(filter => {
        if (nockDef[filter]) {
          nock[filter](nockDef[filter])
        }
      })
      nock.intercept(npath, method, body).reply(status, response, rawHeaders)
    }

    nocks.push(nock)
  })

  return nocks
}

module.exports = Object.assign(startScope, {
  cleanAll,
  activate: globalIntercept.activate,
  isActive: globalIntercept.isActive,
  isDone: globalIntercept.isDone,
  pendingMocks: globalIntercept.pendingMocks,
  activeMocks: globalIntercept.activeMocks,
  removeInterceptor: globalIntercept.removeInterceptor,
  disableNetConnect: globalIntercept.disableNetConnect,
  enableNetConnect: globalIntercept.enableNetConnect,
  load,
  loadDefs,
  define,
  emitter: globalEmitter,
})
