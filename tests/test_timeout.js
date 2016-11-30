'use strict';

var nock    = require('../.');
var test    = require('tap').test;
var http = require('http');

test('http request properly times out', function (t) {
    nock('http://google.com')
        .get('/')
        .delay(1000)
        .reply(200, {});

    var req = http.get({
      host: 'google.com',
      path: '/'
    }, function(res) {
      res.on('data', function(data) {
        // need to listen to data to reach the end
      });

      res.on('end', function() {
        t.fail('should have timed out before reaching here');
        t.end();
      });
    });

    // https://nodejs.org/api/http.html#http_request_settimeout_timeout_callback
    req.setTimeout(10, function() {
      // this should be called before the response ends
      t.end();
    });
});
