import http from 'http'

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
  options: NormalizedRequestOptions
  requestBodyBuffers: Buffer[]
  playbackStarted: boolean
  readyToStartPlaybackOnSocketEvent: boolean
}
