/*
Disabled net connect.
Mock the different hostname:port.
Result: Nock does not allow request to proceed.
*/

const log = require('./_log')

const events = ['socket', 'response', 'end', 'data', 'error']

const nock = require('../')

nock.disableNetConnect()

nock('http://someotherservice.com')
  .get('/')
  .reply(200, 'whaaa')

const http = require('http')
const req = http.get('http://www.google.com/')

req.once('error', function(err) {
  console.log(err.stack)
})

events.forEach(log(req, 'req'))
