import nock from '../index.ts'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'

chai.use(dirtyChai)
chai.use(sinonChai)

afterEach(function () {
  nock.restore()
  nock.abortPendingRequests()
  nock.cleanAll()
  nock.enableNetConnect()
  nock.emitter.removeAllListeners()
  // It's important that Sinon is restored before Nock is reactivated for tests that stub/spy built-in methods,
  // otherwise Sinon loses track of the stubs and can't restore them.
  sinon.restore()
  nock.activate()
})
