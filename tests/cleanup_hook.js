const { afterEach } = require('tap')
const nock = require('..')

module.exports = function registerCleanupHook() {
  // After each test, clean up all of nock's global state. Since tap creates a
  // separate process for each test module, this function must be called at
  // the top of each one.
  afterEach(done => {
    nock.restore()
    nock.cleanAll()
    nock.enableNetConnect()
    nock.activate()
    done()
  })
}
