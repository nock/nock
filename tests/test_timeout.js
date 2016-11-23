'use strict';

var nock    = require('../.');
var test    = require('tap').test;
var request = require('request');

test('something', function (t) {
    nock('http://google.com')
        .get('/')
        .delay(1000)
        .reply(200, {});

    request({
        url: 'http://google.com',
        timeout: 10
    }, function (err, response) {
        t.ok(err);
        t.equal(err.code, 'ETIMEDOUT')
        t.end();
    });
});
