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
var https = require('https')
var readFileSync = require('fs').readFileSync
var resolve = require('path').resolve

function startHttpsServer(middleware, done) {
  var server = https.createServer(
    {
      key: readFileSync(resolve(__dirname, './localhost.key')),
      cert: readFileSync(resolve(__dirname, './localhost.crt')),
    },
    middleware
  )

  server.listen(0, function(error) {
    done(error, server)
  })
}

module.exports = {
  ca: readFileSync(resolve(__dirname, './ca.crt')),
  startServer: startHttpsServer,
}
