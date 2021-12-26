// @ts-check

const emitter = require('./lib/global_emitter')
const {
  activate,
  restore,
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
} = require('./lib/intercept')

const recorder = require('./lib/recorder')
const back = require('./lib/back')

const { Scope, load, loadDefs, define } = require('./lib/scope')

const defaultNockFunction = (basePath, options) => new Scope(basePath, options)
const API = {
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
  restore,
  back,
}

module.exports = Object.assign(defaultNockFunction, API)

// We always activate Nock on import, overriding the globals.
// Setting the Back mode "activates" Nock by overriding the global entries in the `http/s` modules.
// If Nock Back is configured, we need to honor that setting for backward compatibility,
// otherwise we rely on Nock Back's default initializing side effect.
if (isOn()) {
  back.setMode(process.env.NOCK_BACK_MODE || 'dryrun')
}
