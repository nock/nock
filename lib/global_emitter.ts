import type { Interceptor } from './interceptor.ts'
import { EventEmitter } from 'node:events'

export interface InterceptorMatchResult {
  interceptor: Interceptor
  reasons: string[]
}

type EventMap = { 'no match': [req: Request, interceptorResults?: InterceptorMatchResult[]] }

export default new EventEmitter<EventMap>()
