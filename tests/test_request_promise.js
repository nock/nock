'use strict';

var nock = require('../');
var test = require('tap').test;
var rp = require('request-promise');

test("IPV6 URL in request-promise get gets mocked", function(t) {
  var payload = 'somedata'
  var target = 'http://[2607:f0d0:1002:51::4]:8080';

  var scope = nock(target)
    .post('/update')
    .reply(200, payload);

  rp({
    uri: target + '/update',
    method: 'POST',
    body: payload
  }).then(function(res) {
    t.equal(res.toString(), payload, "response should match");
    t.end();
  });

});

