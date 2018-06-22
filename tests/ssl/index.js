'use strict';

var https = require('https');
var readFileSync = require('fs').readFileSync;
var resolve = require('path').resolve;

function startHttpsServer (middleware, done) {
  var server = https.createServer({
    key: readFileSync(resolve(__dirname, './localhost.key')),
    cert: readFileSync(resolve(__dirname, './localhost.crt'))
  }, middleware);

  server.listen(0, function (error) {
    done(error, server)
  });
}

module.exports = {
  ca: readFileSync(resolve(__dirname, './ca.crt')),
  startServer: startHttpsServer
}
