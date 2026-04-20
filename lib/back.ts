import type { Scope } from './scope.ts'
import type { Definition } from './scope.ts'
import type { Interceptor } from './interceptor.ts'
import type { RecorderOptions } from './recorder.ts'

export type BackMode = 'wild' | 'dryrun' | 'record' | 'update' | 'lockdown'

export interface BackOptions {
  before?: (def: Definition) => void
  after?: (scope: Scope) => void
  afterRecord?: (defs: Definition[]) => Definition[] | string
  recorder?: RecorderOptions
}

interface InternalBackMode {
  setup: () => void
  start: (fixture?: any, options?: any) => any
  finish: (fixture?: any, options?: any, context?: any) => void
}

import fs from 'node:fs'
import assert from 'node:assert'
import * as recorder from './recorder.ts'
import {
  activate,
  disableNetConnect,
  enableNetConnect,
  removeAll as cleanAll,
} from './intercept.ts'
import { loadDefs, define } from './scope.ts'
import { back as debug } from './debug.ts'
import { format } from 'node:util'
import path from 'node:path'

let _mode: InternalBackMode | null = null

declare namespace Back {
  let fixtures: string | null
  let currentMode: string
}

function Back(fixtureName: string, nockedFn: (nockDone: () => void) => void): void
function Back(fixtureName: string, options: BackOptions, nockedFn: (nockDone: () => void) => void): void
function Back(fixtureName: string, options?: BackOptions): Promise<{ nockDone: () => void; context: BackContext }>
function Back(fixtureName: string, options?: BackOptions | ((nockDone: () => void) => void), nockedFn?: (nockDone: () => void) => void) {
  if (!Back.fixtures) {
    throw new Error(
      'Back requires nock.back.fixtures to be set\n' +
        'Ex:\n' +
        "\trequire(nock).back.fixtures = '/path/to/fixtures/'",
    )
  }

  if (typeof fixtureName !== 'string') {
    throw new Error('Parameter fixtureName must be a string')
  }

  if (arguments.length === 1) {
    options = {}
  } else if (arguments.length === 2) {
    // If 2nd parameter is a function then `options` has been omitted
    // otherwise `options` haven't been omitted but `nockedFn` was.
    if (typeof options === 'function') {
      nockedFn = options
      options = {}
    }
  }

  ;(_mode as InternalBackMode).setup()

  const fixture = path.join(Back.fixtures as string, fixtureName)
  const context = (_mode as InternalBackMode).start(fixture, options)

  const nockDone = function () {
    ;(_mode as InternalBackMode).finish(fixture, options, context)
  }

  debug('context:', context)
  // If nockedFn is a function then invoke it, otherwise return a promise resolving to nockDone.
  if (typeof nockedFn === 'function') {
    nockedFn.call(context, nockDone)
  } else {
    return Promise.resolve({ nockDone, context })
  }
}

/*******************************************************************************
 *                                    Modes                                     *
 *******************************************************************************/

const wild = {
  setup: function () {
    cleanAll()
    recorder.restore()
    activate()
    enableNetConnect()
  },

  start: function () {
    return load(undefined, undefined) // don't load anything but get correct context
  },

  finish: function () {
    // nothing to do
  },
}

const dryrun = {
  setup: function () {
    recorder.restore()
    cleanAll()
    activate()
    //  We have to explicitly enable net connectivity as by default it's off.
    enableNetConnect()
  },

  start: function (fixture: string, options: BackOptions) {
    const contexts = load(fixture, options)

    enableNetConnect()
    return contexts
  },

  finish: function () {
    // nothing to do
  },
}

const record = {
  setup: function () {
    recorder.restore()
    recorder.clear()
    cleanAll()
    activate()
    disableNetConnect()
  },

  start: function (fixture: string, options: Record<string, any>) {
    if (!fs) {
      throw new Error('no fs')
    }
    const context = load(fixture, options)

    if (!context.isLoaded) {
      recorder.record({
        dont_print: true,
        output_objects: true,
        ...options.recorder,
      })

      context.isRecording = true
    }

    return context
  },

  finish: function (fixture: string, options: BackOptions, context: ReturnType<typeof load>) {
    if (context.isRecording) {
      let outputs: any = recorder.outputs()

      if (typeof options.afterRecord === 'function') {
        outputs = options.afterRecord(outputs)
      }

      const data: string =
        typeof outputs === 'string' ? outputs : JSON.stringify(outputs, null, 4)
      debug('recorder outputs:', data)

      fs.mkdirSync(path.dirname(fixture), { recursive: true })
      fs.writeFileSync(fixture, data)
    }
  },
}

const update = {
  setup: function () {
    recorder.restore()
    recorder.clear()
    cleanAll()
    activate()
    disableNetConnect()
  },

  start: function (fixture: string, options: BackOptions) {
    if (!fs) {
      throw new Error('no fs')
    }
    const context = removeFixture(fixture)
    recorder.record({
      dont_print: true,
      output_objects: true,
      ...options.recorder,
    })

    context.isRecording = true

    return context
  },

  finish: function (fixture: string, options: BackOptions) {
    let outputs: any = recorder.outputs()

    if (typeof options.afterRecord === 'function') {
      outputs = options.afterRecord(outputs)
    }

    const data: string =
      typeof outputs === 'string' ? outputs : JSON.stringify(outputs, null, 4)
    debug('recorder outputs:', data)

    fs.mkdirSync(path.dirname(fixture), { recursive: true })
    fs.writeFileSync(fixture, data)
  },
}

const lockdown = {
  setup: function () {
    recorder.restore()
    recorder.clear()
    cleanAll()
    activate()
    disableNetConnect()
  },

  start: function (fixture: string, options: BackOptions) {
    return load(fixture, options)
  },

  finish: function () {
    // nothing to do
  },
}

function load(fixture?: string, options?: BackOptions | Record<string, any>) {
  const context = {
    isLoaded: false,
    isRecording: false,
    scopes: [] as Scope[],
    assertScopesFinished: function () {
      assertScopes(this.scopes, fixture)
    },
    query: function () {
      return this.scopes.flatMap((scope: Scope) =>
        scope.interceptors.map((interceptor: Interceptor) => ({
          method: interceptor.method,
          uri: interceptor.uri,
          basePath: interceptor.basePath,
          path: interceptor.path,
          queries: interceptor.queries,
          counter: interceptor.counter,
          body: interceptor.body,
          statusCode: interceptor.statusCode,
          optional: interceptor.optional,
        })),
      )
    },
  }

  if (fixture && fixtureExists(fixture)) {
    let scopes = loadDefs(fixture)

    applyHook(scopes, options?.before)

    scopes = define(scopes)
    applyHook(scopes, options?.after)

    context.scopes = scopes
    context.isLoaded = true
  }

  return context
}

export type BackContext = Omit<ReturnType<typeof load>, 'isRecording'>
export type InterceptorSurface = ReturnType<BackContext['query']>[number]

function removeFixture(fixture: string) {
  const context = {
    scopes: [] as Scope[],
    assertScopesFinished: () => {},
    isLoaded: false,
    isRecording: false,
  }

  if (fixture && fixtureExists(fixture)) {
    /* istanbul ignore next - fs.unlinkSync is for node 10 support */
    fs.rmSync ? fs.rmSync(fixture) : fs.unlinkSync(fixture)
  }
  return context
}

function applyHook(items: any[], fn: Function | undefined) {
  if (!fn) {
    return
  }

  if (typeof fn !== 'function') {
    throw new Error('processing hooks must be a function')
  }

  items.forEach(fn as any)
}

function fixtureExists(fixture: string) {
  if (!fs) {
    throw new Error('no fs')
  }

  return fs.existsSync(fixture)
}

function assertScopes(scopes: Scope[], fixture?: string) {
  const pending = scopes
    .filter((scope: Scope) => !scope.isDone())
    .map((scope: Scope) => scope.pendingMocks())

  if (pending.length) {
    assert.fail(
      format(
        '%j was not used, consider removing %s to rerecord fixture',
        ([] as string[]).concat(...pending),
        fixture,
      ),
    )
  }
}

const Modes: Record<string, InternalBackMode> = {
  wild, // all requests go out to the internet, dont replay anything, doesnt record anything
  dryrun, // use recorded nocks, allow http calls, doesnt record anything, useful for writing new tests (default)
  record, // use recorded nocks, record new nocks
  update, // allow http calls, record all nocks, don't use recorded nocks
  lockdown, // use recorded nocks, disables all http calls even when not nocked, doesnt record
}

Back.setMode = function (mode: string) {
  if (!(mode in Modes)) {
    throw new Error(`Unknown mode: ${mode}`)
  }

  Back.currentMode = mode
  debug('New nock back mode:', Back.currentMode)

  _mode = Modes[mode as keyof typeof Modes] as InternalBackMode
  _mode.setup()
}

Back.fixtures = null as string | null
Back.currentMode = '' as string

export type Back = typeof Back

export default Back
