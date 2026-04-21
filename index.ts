import type { Options, Definition } from './lib/scope.ts'
import type {
  BackOptions,
  BackContext,
  BackMode,
  Back,
  InterceptorSurface,
} from './lib/back.ts'
import type { RecorderOptions } from './lib/recorder.ts'
import type { InterceptorMatchResult } from './lib/global_emitter.ts'
import type {
  DataMatcher,
  DataMatcherArray,
  DataMatcherMap,
  RequestBodyMatcher,
  RequestHeaderMatcher,
  Body,
  ReplyBody,
  ReplyHeaderFunction,
  ReplyHeaderValue,
  ReplyHeaders,
  StatusCode,
  ReplyFnResult,
  Interceptor,
} from './lib/interceptor.ts'
import type { Scope } from './lib/scope.ts'

import back from './lib/back.ts'
import emitter from './lib/global_emitter.ts'
import {
  activate,
  isActive,
  isDone,
  isOn,
  pendingMocks,
  activeMocks,
  removeInterceptor,
  disableNetConnect,
  enableNetConnect,
  removeAll,
  abortPendingRequests,
} from './lib/intercept.ts'
import * as recorder from './lib/recorder.ts'
import { Scope as ScopeClass, load, loadDefs, define } from './lib/scope.ts'
import { getGetRequestBody } from './lib/utils/node/index.ts'

function nock(basePath: string | RegExp | URL, options?: Options) {
  return new ScopeClass(basePath, options)
}

nock.activate = activate
nock.isActive = isActive
nock.isDone = isDone
nock.pendingMocks = pendingMocks
nock.activeMocks = activeMocks
nock.removeInterceptor = removeInterceptor
nock.disableNetConnect = disableNetConnect
nock.enableNetConnect = enableNetConnect
nock.cleanAll = removeAll
nock.abortPendingRequests = abortPendingRequests
nock.load = load
nock.loadDefs = loadDefs
nock.define = define
nock.emitter = emitter
nock.recorder = {
  rec: recorder.record,
  clear: recorder.clear,
  play: recorder.outputs,
}
nock.restore = recorder.restore
nock.back = back
nock.getGetRequestBody = getGetRequestBody

export default nock

// Re-export types into the nock namespace so consumers can use nock.Scope, nock.Options, etc.
declare namespace nock {
  export type { Scope }
  export type { Interceptor }
  export type { Options }
  export type { Definition }
  export type { BackMode }
  export type { BackContext }
  export type { BackOptions }
  export type { RecorderOptions }
  export type { InterceptorSurface }
  export type { InterceptorMatchResult }
  export type { DataMatcher }
  export type { DataMatcherArray }
  export type { DataMatcherMap }
  export type { RequestBodyMatcher }
  export type { RequestHeaderMatcher }
  export type { Body }
  export type { ReplyBody }
  export type { ReplyHeaderFunction }
  export type { ReplyHeaderValue }
  export type { ReplyHeaders }
  export type { StatusCode }
  export type { ReplyFnResult }
  export type { Back }
}

// We always activate Nock on import, overriding the globals.
// Setting the Back mode "activates" Nock by overriding the global entries in the `http/s` modules.
// If Nock Back is configured, we need to honor that setting for backward compatibility,
// otherwise we rely on Nock Back's default initializing side effect.
if (isOn()) {
  back.setMode(process.env.NOCK_BACK_MODE || 'dryrun')
}
