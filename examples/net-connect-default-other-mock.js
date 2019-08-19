/*
Default net connect.
Mock the different hostname:port.
Result: Nock allows request to proceed.
*/

const log = require('./_log')

const events = ['socket', 'response', 'end', 'data', 'error']

const nock = require('../')

nock('http://someotherservice.com')
  .get('/')
  .reply(200, 'whaaa')

const http = require('http')
const req = http.get('http://www.google.com/', function(res) {
  console.log('request result: res.statusCode = %j', res.statusCode)
  events.forEach(log(res, 'res'))
})

events.forEach(log(req, 'req'))
