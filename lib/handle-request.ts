import type { Interceptor } from './interceptor.ts'
import globalEmitter from './global_emitter.ts'
import * as common from './common.ts'
import { playbackInterceptor } from './playback_interceptor.ts'
import { interceptorsFor, isOn, isEnabledForNetConnect } from './intercept.ts'

async function handleRequest(request: Request) {
  const url = new URL(request.url)
  const interceptors = interceptorsFor(url)

  if (isOn() && interceptors) {
    const matches = interceptors.some((interceptor: Interceptor) =>
      interceptor.matchOrigin(request),
    )
    const allowUnmocked = interceptors.some(
      (interceptor: Interceptor) => interceptor.options.allowUnmocked,
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

      const matchResults: {interceptor: Interceptor, reasons: string[]}[] = []
      const matchedInterceptor = interceptors.find((i: Interceptor) => {
        const reasons = i.match(request, requestBodyString)
        if (reasons.length > 0) {
          matchResults.push({ interceptor: i, reasons })
          return false
        } else {
          return true
        }
      })

      if (matchedInterceptor) {
        matchedInterceptor.scope.logger(
          'interceptor identified, starting mocking',
        )

        matchedInterceptor.markConsumed()

        if (matchedInterceptor.isPassthrough) {
          return
        }

        const response = await playbackInterceptor({
          decompressedRequest: request,
          requestBodyString,
          interceptor: matchedInterceptor,
          requestBodyIsUtf8Representable,
        })

        return response
      } else {
        globalEmitter.emit(
          'no match',
          request,
          matchResults.sort((a, b) => a.reasons.length - b.reasons.length),
        )

        // Try to find a hostname match that allows unmocked.
        const allowUnmocked = interceptors.some(
          (i: Interceptor) => i.matchHostName(url.hostname) && i.options.allowUnmocked,
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

class NetConnectNotAllowedError extends Error {
  declare code: string

  constructor(host: string, path: string) {
    super(`Nock: Disallowed net connect for "${host}${path}"`)
    this.name = 'NetConnectNotAllowedError'
    this.code = 'ENETUNREACH'
  }
}

export default handleRequest
