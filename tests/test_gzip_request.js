'use strict';

var nock = require('../');
var test = require('tap').test;
var http = require('http');
var assert = require('assert');
var zlib = require('zlib');

if (zlib.gzipSync && zlib.gunzipSync) {
  test('accepts and decodes gzip encoded application/json', function (t) {
    var message = {
      my: 'contents'
    };

    t.plan(1);

    nock('http://gzipped.com')
      .post('/')
      .reply(function (url, actual) {
        t.same(actual, message);
        t.end();
        return 200
      });

    var req = http.request({
        hostname: 'gzipped.com',
        path: '/',
        method: 'POST',
        headers: {
          'content-encoding': 'gzip',
          'content-type': 'application/json'
        }
      });

    var compressedMessage = zlib.gzipSync(JSON.stringify(message));

    req.write(compressedMessage);
    req.end();
  });
}

if (zlib.deflateSync && zlib.inflateSync) {

  test('accepts and decodes deflate encoded application/json', function (t) {
    var message = {
      my: 'contents'
    };

    t.plan(1);

    nock('http://gzipped.com')
      .post('/')
      .reply(function (url, actual) {
        t.same(actual, message);
        t.end();
        return 200
      });

    var req = http.request({
        hostname: 'gzipped.com',
        path: '/',
        method: 'POST',
        headers: {
          'content-encoding': 'deflate',
          'content-type': 'application/json'
        }
      });

    var compressedMessage = zlib.deflateSync(JSON.stringify(message));

    req.write(compressedMessage);
    req.end();
  });
}
