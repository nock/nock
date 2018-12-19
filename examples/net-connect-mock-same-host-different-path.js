/*
Default net connect.
Mock the same hostname:port, different path.
Result: Nock does not allow request to proceed.
*/

const log = require('./_log')

const events = ['socket', 'response', 'end', 'data', 'error']

const nock = require('../')

nock('http://example.com')
  .get('/path')
  .reply(200, 'whaaa')

const http = require('http')
const req = http.get('http://example.com/other-path')

req.once('error', function(err) {
  console.log(err.stack)
})

events.forEach(log(req, 'req'))
