'use strict'

const https = require('https')
const http = require('http')

module.exports.httpRequest = url =>
  new Promise((resolve, reject) => {
    const { hostname, pathname, port, protocol } = new URL(url)

    const requestOptions = {
      hostname,
      path: pathname,
      port,
      method: 'GET',
    }

    const httpRequestLib = protocol === 'https:' ? https : http
    const httpRequest = httpRequestLib.request(requestOptions, res => {
      let rawData = ''
      res.setEncoding('utf8')
      res.on('data', chunk => {
        rawData += chunk
      })
      res.on('end', () => {
        resolve({ data: rawData, status: res.statusCode })
      })
    })

    httpRequest
      .on('timeout', () => httpRequest.destroy())
      .on('error', e => reject(e))
      .end()
  })
