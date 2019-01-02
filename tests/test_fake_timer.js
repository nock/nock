'use strict'

const nock = require('../.');
const test = require('tap').test;
const request = require('request');
const lolex = require('lolex');

test('one function returns successfully when fake timer is enabled', function(t) {
  let clock = lolex.install();
  nock('http://www.google.com')
    .get('/')
    .reply(200);

  request.get('http://www.google.com', function(err, resp) {
    clock.uninstall();
    if (err) {
      throw err;
    }
    t.equal(resp.statusCode, 200);
    t.end();
  });
});
