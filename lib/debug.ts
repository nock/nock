import type { DebugLoggerFunction } from 'node:util'
import { debuglog } from 'node:util'

export const back = debuglog('nock:back') as DebugLoggerFunction
export const common = debuglog('nock:common') as DebugLoggerFunction
export const intercept = debuglog('nock:intercept') as DebugLoggerFunction
export const request_overrider = debuglog(
  'nock:request_overrider',
) as DebugLoggerFunction
export const playback_interceptor = debuglog(
  'nock:playback_interceptor',
) as DebugLoggerFunction
export const recorder = debuglog('nock:recorder') as DebugLoggerFunction
export const socket = debuglog('nock:socket') as DebugLoggerFunction

export const scopeDebuglog = (namespace: string) =>
  debuglog(`nock:scope:${namespace}`)
