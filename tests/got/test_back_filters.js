import { expect } from 'chai'
import fs from 'node:fs'
import path from 'node:path'
import rimraf from 'rimraf'

import got from './got_client.js'
import { startHttpServer } from '../servers/index.js'

import nock from '../../index.ts'

const nockBack = nock.back
const originalMode = nockBack.currentMode
const fixturesDir = path.resolve(import.meta.dirname, 'fixtures')
const fixtureFilename = 'recording_filters_test.json'
const fixtureFullPath = path.resolve(fixturesDir, fixtureFilename)

const getFixtureContent = () =>
  JSON.parse(fs.readFileSync(fixtureFullPath).toString())

describe('nockBack filters', () => {
  beforeEach(() => {
    nockBack.fixtures = fixturesDir
    nockBack.setMode('record')
  })

  afterEach(() => {
    rimraf.sync(fixtureFullPath)
  })

  it('should pass filteringPath options', async () => {
    const server = await startHttpServer()
    const nockBackOptions = {
      before(scope) {
        scope.filteringPath = path =>
          path.replace(/timestamp=[0-9]+/, 'timestamp=1111')
      },
    }

    const back1 = await nockBack(fixtureFilename, nockBackOptions)
    const response1 = await got(`${server.origin}/?timestamp=1111`)
    back1.nockDone()

    const fixtureContent = getFixtureContent()
    expect(fixtureContent).to.have.lengthOf(1)
    expect(fixtureContent[0].path).to.equal('/?timestamp=1111')

    const back2 = await nockBack(fixtureFilename, nockBackOptions)
    const response2 = await got(`${server.origin}/?timestamp=2222`)
    back2.nockDone()

    expect(response2.body).to.deep.equal(response1.body)

    const fixtureContentReloaded = getFixtureContent()
    expect(fixtureContentReloaded).to.have.lengthOf(1)
    expect(fixtureContentReloaded[0].path).to.equal('/?timestamp=1111')
  })

  it('should pass filteringRequestBody options', async () => {
    const server = await startHttpServer()
    const nockBackOptions = {
      before(scope) {
        scope.filteringRequestBody = (body, recordedBody) => {
          const regExp = /token=[a-z-]+/
          const recordedBodyMatched = recordedBody.match(regExp)

          if (recordedBodyMatched && regExp.test(body)) {
            return body.replace(regExp, recordedBodyMatched[0])
          }

          return body
        }
      },
    }

    const back1 = await nockBack(fixtureFilename, nockBackOptions)
    const response1 = await got.post(server.origin, {
      form: { token: 'aaa-bbb-ccc' },
    })
    back1.nockDone()

    const fixtureContent = getFixtureContent()
    expect(fixtureContent).to.have.lengthOf(1)
    expect(fixtureContent[0].body).to.equal('token=aaa-bbb-ccc')

    const back2 = await nockBack(fixtureFilename, nockBackOptions)
    const response2 = await got.post(server.origin, {
      form: { token: 'ddd-eee-fff' },
    })
    back2.nockDone()

    expect(response2.text).to.deep.equal(response1.text)

    const fixtureContentReloaded = getFixtureContent()
    expect(fixtureContentReloaded).to.have.lengthOf(1)
    expect(fixtureContentReloaded[0].body).to.equal('token=aaa-bbb-ccc')
  })

  it('should be able to reset the mode', () => {
    nockBack.setMode(originalMode)
  })
})
