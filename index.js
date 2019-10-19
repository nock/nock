'use strict'

const back = require('./lib/back')
const emitter = require('./lib/global_emitter')
const {
  activate,
  isActive,
  isDone,
  pendingMocks,
  activeMocks,
  removeInterceptor,
  disableNetConnect,
  enableNetConnect,
  removeAll,
  abortPendingRequests,
} = require('./lib/intercept')
const recorder = require('./lib/recorder')
const { Scope, load, loadDefs, define } = require('./lib/scope')

module.exports = (basePath, options) => new Scope(basePath, options)

Object.assign(module.exports, {
  activate,
  isActive,
  isDone,
  pendingMocks,
  activeMocks,
  removeInterceptor,
  disableNetConnect,
  enableNetConnect,
  // TODO-12.x Historically `nock.cleanAll()` has returned the nock global.
  // The other global methods do noto do this, so it's not clear this was
  // deliberate or is even helpful. This shim is included for backward
  // compatibility and shoulud be replaced with an alias to `removeAll()`.
  cleanAll() {
    removeAll()
    return module.exports
  },
  abortPendingRequests,
  load,
  loadDefs,
  define,
  emitter,
  recorder: {
    rec: recorder.record,
    clear: recorder.clear,
    play: recorder.outputs,
  },
  restore: recorder.restore,
  back,
})
