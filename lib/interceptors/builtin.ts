import * as common from '../common.ts'
import handleRequest from '../handle-request.ts'
import { setGetRequestBody } from '../utils/node/index.ts'
import { BatchInterceptor } from '@mswjs/interceptors'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { HttpRequestInterceptor } from '@mswjs/interceptors/http'

const interceptor = new BatchInterceptor({
  name: 'intercept',
  interceptors: [new HttpRequestInterceptor(), new FetchInterceptor()]
})

function activate() {
  interceptor.apply()

  // Force msw to forward Nock's error instead of coerce it into 500 error
  interceptor.on('unhandledException', ({ controller, error }: any) => {
    controller.errorWith(error)
  })
  interceptor.on('request', async function ({ request, controller, initiator }) {
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
      controller.respondWith(response)
    }
  })
}

function deactivate() {
  interceptor.dispose()
}

export { activate, deactivate }
