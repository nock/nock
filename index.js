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
  cleanAll: removeAll,
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
