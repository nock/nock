import { Readable as ReadableStream } from 'node:stream'

const kGetRequestBody: unique symbol = Symbol('kGetRequestBody') as any

function getGetRequestBody(request: Request) {
  if (request.method !== 'GET') {
    throw new Error('The request method must be GET')
  }
  return ReadableStream.from(Reflect.get(request, kGetRequestBody))
}

function setGetRequestBody(request: Request, body: ArrayBuffer) {
  Reflect.set(request, kGetRequestBody, Buffer.from(body))
}

export { getGetRequestBody, setGetRequestBody }
