import http from 'node:http'
import { Socket } from 'node:net'
import * as common from '../common.ts'
import handleRequest from '../handle-request.ts'
import { setGetRequestBody } from '../utils/node/index.ts'
import { BatchInterceptor } from '@mswjs/interceptors'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { HttpRequestInterceptor } from '@mswjs/interceptors/http'

const interceptor = new BatchInterceptor({
  name: 'intercept',
  interceptors: [new HttpRequestInterceptor(), new FetchInterceptor()],
})

function activate() {
  interceptor.apply()

  // Force msw to forward Nock's error instead of coerce it into 500 error
  interceptor.on('unhandledException', ({ controller, error }: any) => {
    controller.errorWith(error)
  })
  interceptor.on(
    'request',
    async function ({ request, controller, initiator }) {
      if (request.headers.get('expect') === '100-continue') {
        // We currently do not support mocking 100-continue responses, so they are passed through for now.
        return
      }

      // If this is GET request with body, we need to read the body from the socket because Fetch API doesn't support this.
      const requestBodyBuffer: ArrayBuffer = common.decompressRequestBody(
        await request.clone().arrayBuffer(),
        request.headers.get('content-encoding') || '',
      ) as ArrayBuffer

      const decompressedRequest = new Request(request, {
        body:
          requestBodyBuffer.byteLength > 0 && request.method !== 'GET'
            ? requestBodyBuffer
            : undefined,
      })
      if (requestBodyBuffer.byteLength > 0 && request.method === 'GET') {
        setGetRequestBody(decompressedRequest, requestBodyBuffer)
      }

      const response = await handleRequest(decompressedRequest)
      if (response) {
        // A real server cannot respond before the client has finished
        // sending the request. Clients that declare the body length up
        // front (e.g. got 16 sets `Content-Length`) have the request
        // message parsed and the body consumed as soon as the last body
        // byte is written, but complete the request (`end()`) a tick
        // later. A mocked response delivered in between looks to such
        // clients like an aborted request, and they destroy it with
        // `ECONNRESET` ("The server aborted pending request").
        // Hold the response until the underlying request has finished
        // writing, but only when the request declares a body: bodyless
        // requests may never be completed by the client (e.g.
        // `flushHeaders()` without `end()`), and a real server responds
        // to those as soon as headers arrive.
        // https://github.com/nock/nock/issues/3027
        const clientRequest =
          initiator instanceof http.ClientRequest
            ? initiator
            : initiator instanceof Socket
              ? // `net.Socket` carries the in-flight request on this
                // internal property (undocumented, but set by Node's http
                // client for every request on that socket).
                (initiator as Socket & { _httpMessage?: http.ClientRequest })
                  ._httpMessage
              : undefined
        const contentLength = Number(request.headers.get('content-length')) || 0
        const isChunked = request.headers
          .get('transfer-encoding')
          ?.includes('chunked')
        if (
          clientRequest &&
          !clientRequest.writableFinished &&
          (contentLength > 0 || isChunked)
        ) {
          await Promise.race([
            new Promise<void>(resolve => clientRequest.once('finish', resolve)),
            new Promise<void>(resolve => clientRequest.once('close', resolve)),
          ])
        }
        controller.respondWith(response)
      }
    },
  )
}

function deactivate() {
  interceptor.dispose()
}

export { activate, deactivate }
