import http from 'http'

export type OnInterceptCallback = (request: http.ClientRequest) => void

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
  onIntercept: OnInterceptCallback
  options: NormalizedRequestOptions
  requestBodyBuffers: Buffer[]
  interceptStarted: boolean
  readyToInterceptOnSocketEvent: boolean
}
