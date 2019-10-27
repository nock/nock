'use strict'

const nock = require('..')
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const tap = require('tap')

if (!global.context) {
  tap.mochaGlobals()
}

chai.use(dirtyChai)
chai.use(sinonChai)

afterEach(function() {
  nock.restore()
  nock.cleanAll()
  nock.enableNetConnect()
  nock.activate()
  sinon.restore()
})
