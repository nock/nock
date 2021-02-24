'use strict'

// With OpenSSL installed, you can set up your CA and certificates with
// the following commands, valid for 10 years:
//
//   openssl genrsa -out localhost.key 2048
//   # Set the common name to "localhost"
//   openssl req -new -key localhost.key -out localhost.csr
//   openssl genrsa -out ca.key 2048
//   # Set the common name to "Nock CA"
//   openssl req -new -x509 -key ca.key -out ca.crt -days 3650
//   openssl x509 -req -in localhost.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out localhost.crt -days 3650
//   rm ca.srl localhost.csr
//
const http = require('http')
const https = require('https')
const path = require('path')
const fs = require('fs')

const servers = []

afterEach(() => {
  while (servers.length) {
    const server = servers.pop()
    server.close()
  }
})

const defaultRequestListener = (req, res) => {
  res.writeHead(200)
  res.write('OK')
  res.end()
}

async function startHttpServer(requestListener = defaultRequestListener) {
  const server = http.createServer(requestListener)
  await new Promise(resolve => server.listen(resolve))
  servers.push(server)
  server.port = server.address().port
  server.origin = `http://localhost:${server.port}`
  return server
}

async function startHttpsServer(requestListener = defaultRequestListener) {
  const server = https.createServer(
    {
      key: fs.readFileSync(path.resolve(__dirname, './localhost.key')),
      cert: fs.readFileSync(path.resolve(__dirname, './localhost.crt')),
    },
    requestListener
  )
  await new Promise(resolve => server.listen(resolve))
  servers.push(server)
  server.port = server.address().port
  server.origin = `https://localhost:${server.port}`
  return server
}

module.exports = {
  ca: fs.readFileSync(path.resolve(__dirname, './ca.crt')),
  startHttpServer,
  startHttpsServer,
}
