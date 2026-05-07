/*
Disabled net connect.
Mock the different hostname:port.
Result: Nock does not allow request to proceed.
*/

import log from './_log.js'

const events = ['socket', 'response', 'end', 'data', 'error']

import nock from '../index.ts'

nock.disableNetConnect()

nock('http://someotherservice.com').get('/').reply(200, 'whaaa')

import http from 'node:http'
const req = http.get('http://www.google.com/')

req.once('error', function (err) {
  console.log(err.stack)
})

events.forEach(log(req, 'req'))
