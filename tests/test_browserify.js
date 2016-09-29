'use strict';

if (process.versions.node >= '0.11' ) {
    var fs = require('fs');
    var path = require('path');
    var http = require('http');
    var browserify = require('browserify');
    var Static = require('node-static');
    var Browser = require('zombie');

    var test = require('tap').test;
    var before = test;
    var after  = test;

    var nock = require('../.');

    nock.enableNetConnect();

    var server;

    before('prepare bundle', {timeout: 10000}, function(t) {
      var b = browserify();
      b.add(path.join(__dirname, 'fixtures', 'browserify-script.js'));
      b.bundle().pipe(fs.createWriteStream(path.join(__dirname, 'browserify-public', 'browserify-bundle.js'))).once('finish', function() {
        t.end();
      });
    });

    before('start server', function(t) {
      var file = new Static.Server(path.join(__dirname, 'browserify-public'));
      server = http.createServer(function(req, res) {
        file.serve(req, res);
      });

      server.listen(8080, t.end.bind(t));
    });

    test('run bundle', function(t) {
      Browser.localhost('server.com', 8080);

      var browser = new Browser();

      browser.on('error', function(err) {
        console.error('BROWSER ERROR: ' + err.stack);
      });

      browser.visit('/', function() {
        browser.assert.text('#content', 'boop');
        t.end();
      });
    });

    after('stop server', function(t) {
      server.close(t.end.bind(t));
    });
}
