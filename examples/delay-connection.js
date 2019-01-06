const http = require('http')
const nock = require('../')
const log = require('./_log')
const events = ['socket', 'response', 'end', 'data']

nock('http://delayconnection.com')
  .get('/')
  .delayConnection(1000)
  .reply(200, 'hey')

const req = http.get('http://delayconnection.com', function(res) {
  events.forEach(log(res, 'res'))
})

events.forEach(log(req, 'req'))
