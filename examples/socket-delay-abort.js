const http = require('node:http')
const nock = require('../')
const log = require('./_log')
const events = ['socket', 'response', 'end', 'data', 'timeout', 'error']

nock('http://delayconnection.com').get('/').socketDelay(2000).reply(200, 'hey')

const req = http.get('http://delayconnection.com', function (res) {
  events.forEach(log(res, 'res'))
})

req.setTimeout(1000, function () {
  req.abort()
})

events.forEach(log(req, 'req'))
