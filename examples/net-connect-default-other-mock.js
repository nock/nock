/*
Default net connect.
Mock the different hostname:port.
Result: Nock allows request to proceed.
*/

import log from './_log.js'

const events = ['socket', 'response', 'end', 'data', 'error']

import nock from '../index.ts'

nock('http://someotherservice.com').get('/').reply(200, 'whaaa')

import http from 'node:http'
const req = http.get('http://www.google.com/', function (res) {
  console.log('request result: res.statusCode = %j', res.statusCode)
  events.forEach(log(res, 'res'))
})

events.forEach(log(req, 'req'))
