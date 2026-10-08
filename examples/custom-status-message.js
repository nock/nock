const http = require('http')
const nock = require('../')

nock('http://example.com')
  .get('/teapot')
  .reply(418, function () {
    this.req.response.statusMessage = "I'm a Teapot"
    return 'short and stout'
  })

const req = http.get('http://example.com/teapot', res => {
  console.log('Status Code:', res.statusCode)
  console.log('Status Message:', res.statusMessage)

  let body = ''
  res.on('data', chunk => {
    body += chunk
  })
  res.on('end', () => {
    console.log('Body:', body)
  })
})

req.on('error', console.error)
