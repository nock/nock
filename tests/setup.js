'use strict'

const nock = require('..')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

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
