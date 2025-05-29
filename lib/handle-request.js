'use strict'
const { inherits } = require('node:util')
const globalEmitter = require('./global_emitter')
const common = require('./common')
const { playbackInterceptor } = require('./playback_interceptor')

/**
 * @param {Request} request
 */
async function handleRequest(request) {
  const {
    interceptorsFor,
    isOn,
    isEnabledForNetConnect,
  } = require('./intercept')
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
      const requestBodyBuffer = await request.clone().arrayBuffer()
      // When request body is a binary buffer we internally use in its hexadecimal representation.
      const requestBodyIsUtf8Representable =
        common.isUtf8Representable(requestBodyBuffer)
      const requestBodyString = Buffer.from(requestBodyBuffer).toString(
        requestBodyIsUtf8Representable ? 'utf8' : 'hex',
      )

      const matchedInterceptor = interceptors.find(i =>
        i.match(request, requestBodyString),
      )

      if (matchedInterceptor) {
        matchedInterceptor.scope.logger(
          'interceptor identified, starting mocking',
        )

        matchedInterceptor.markConsumed()

        const response = await playbackInterceptor({
          decompressedRequest: request,
          requestBodyString,
          interceptor: matchedInterceptor,
          requestBodyIsUtf8Representable,
        })

        return response
      } else {
        globalEmitter.emit('no match', request)

        // Try to find a hostname match that allows unmocked.
        const allowUnmocked = interceptors.some(
          i => i.matchHostName(url.hostname) && i.options.allowUnmocked,
        )

        if (!allowUnmocked) {
          const body = JSON.stringify({
            code: 'ERR_NOCK_NO_MATCH',
            message: `Nock: No match for request ${common.stringifyRequest(request, requestBodyString)}`,
          })
          return new Response(body, {
            status: 501,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
    }
  } else {
    globalEmitter.emit('no match', request)
    // Remove http(s):// for backward compatibility until we decide this Error.
    const normalizedUrl = common
      .normalizeOrigin(url)
      .replace(`${url.protocol}//`, '')
    if (isOn() && !isEnabledForNetConnect(normalizedUrl)) {
      throw new NetConnectNotAllowedError(normalizedUrl, url.pathname)
    }
  }
}

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

module.exports = handleRequest
