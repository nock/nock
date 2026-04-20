/*
Default net connect.
Mock the same hostname:port, different path.
Result: Nock does not allow request to proceed.
*/

import log from './_log.js'

const events = ['socket', 'response', 'end', 'data', 'error']

import nock from '../index.ts'

nock('http://example.com').get('/path').reply(200, 'whaaa')

import http from 'node:http'
const req = http.get('http://example.com/other-path')

req.once('error', function (err) {
  console.log(err.stack)
})

events.forEach(log(req, 'req'))
