import http from 'node:http'
import nock from '../index.ts'
import log from './_log.js'
const events = ['socket', 'response', 'end', 'data', 'timeout', 'error']

nock('http://delayconnection.com').get('/').socketDelay(2000).reply(200, 'hey')

const req = http.get('http://delayconnection.com', function (res) {
  events.forEach(log(res, 'res'))
})

events.forEach(log(req, 'req'))
