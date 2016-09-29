'use strict';

if (process.versions.node >= '0.11' ) {
    var nock = require('../');
    var test = require('tap').test;
    var fetch = require('isomorphic-fetch');

    test("basic match works", function(t) {
      var scope = nock('http://isomorphicfetchland.com').
        get('/path').
        reply(200, 'somedata');

      fetch('http://isomorphicfetchland.com/path').
        then(function(res) {
          return res.text();
        }).
        then(function(text) {
          scope.done();
          t.equal(text, 'somedata', "response should match");
          t.end();
        }).
        catch(function(err) {
          throw err;
        });
    });

    test("string-based reqheaders match works", function(t) {
      var scope = nock('http://isomorphicfetchland.com', {
          reqheaders: {
            'header': 'header value',
          }
        }).
        get('/path2').
        reply(200, 'somemoardata');

      fetch('http://isomorphicfetchland.com/path2', {
        headers: {
          'header': 'header value',
        }
      }).
        then(function(res) {
          return res.text();
        }).
        then(function(text) {
          scope.done();
          t.equal(text, 'somemoardata', "response should match");
          t.end();
        }).
        catch(function(err) {
          throw err;
        });
    });
}
