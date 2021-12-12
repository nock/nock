import http from 'http'

export type OnInterceptCallback = (
  options: NormalizedRequestOptions,
  request: http.ClientRequest
) => void
export type OnResponseCallback = (request: http.IncomingMessage) => void

export type NormalizedRequestOptions = {
  protocol: 'http:' | 'https:'
  hostname: string
  hash: string
  search: string
  pathname: string
  path: string
  href: string
  port: number
  host: string
  headers: http.OutgoingHttpHeaders
}

export type State = {
  intercepted: boolean
  onIntercept: OnInterceptCallback
  options: NormalizedRequestOptions
  onResponseCallback: OnResponseCallback
  requestBodyBuffers: Buffer[]
  interceptStarted: boolean
  readyToInterceptOnSocketEvent: boolean
}
