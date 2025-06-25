'use strict'

const http = require('node:http')
const { getRawRequest, BatchInterceptor } = require('@mswjs/interceptors')
const {
  default: nodeInterceptors,
} = require('@mswjs/interceptors/presets/node')
const common = require('../common')
const handleRequest = require('../handle-request')
const { arrayBuffer } = require('node:stream/consumers')
const { getClientRequestBodyStream } = require('@mswjs/interceptors/utils/node')
const { setDecompressedGetBody } = require('../utils/node')

const interceptor = new BatchInterceptor({
  name: 'nock-interceptor',
  interceptors: nodeInterceptors,
})

function activate() {
  interceptor.apply()

  // Force msw to forward Nock's error instead of coerce it into 500 error
  interceptor.on('unhandledException', ({ controller, error }) => {
    controller.errorWith(error)
  })
  interceptor.on('request', async function ({ request, controller }) {
    if (request.headers.get('expect') === '100-continue') {
      // We currently does not support mocked 100-continue response, so let it pass through for now.
      return
    }
    const rawRequest = getRawRequest(request)

    // If this is GET request with body, we need to read the body from the socket because Fetch API doesn't support this.
    const requestBodyBuffer = common.decompressRequestBody(
      rawRequest instanceof http.ClientRequest &&
        request.method === 'GET' &&
        request.headers.get('content-length') > 0
        ? await arrayBuffer(getClientRequestBodyStream(request))
        : await request.clone().arrayBuffer(),
      request.headers.get('content-encoding') || '',
    )

    const decompressedRequest = new Request(request, {
      body:
        requestBodyBuffer.length > 0 && request.method !== 'GET'
          ? requestBodyBuffer
          : undefined,
    })
    if (requestBodyBuffer.byteLength > 0 && request.method === 'GET') {
      setDecompressedGetBody(decompressedRequest, requestBodyBuffer)
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

module.exports = {
  activate,
  deactivate,
}
