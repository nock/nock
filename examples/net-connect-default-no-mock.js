/*
Default net connect.
No mock.
Result: Nock allows request to proceed.
*/

const log = require('./_log')

const events = ['socket', 'response', 'end', 'data', 'error']

const http = require('http')
console.log('making request...')
const req = http.get('http://www.google.com/', function(res) {
  console.log('request result: res.statusCode = %j', res.statusCode)
  events.forEach(log(res, 'res'))
})

events.forEach(log(req, 'req'))
