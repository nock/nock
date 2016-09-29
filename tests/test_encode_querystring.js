var nock    = require('../.');
var request = require('request');
var test    = require('tap').test;

test('encode query string', function(t) {
  var query1 = { q: '(nodejs)' };
  var query2 = { q: '(wrong)' };

  nock('https://encodeland.com')
    .get('/test')
    .query(query1)
    .reply(200, 'success')

  request({
    url: 'https://encodeland.com/test',
    qs: query1,
    method: 'GET'
  }, function(error, response, body) {
    t.ok(!error);
    t.deepEqual(body, 'success');

    request({
      url: 'https://encodeland.com/test',
      qs: query2,
      method: 'GET'
    }, function(error, response, body) {
      t.type(error, Error, 'expect an error');
      t.match(error.message, 'No match for request');

      request({
        url: 'https://encodeland.com/test',
        method: 'GET'
      }, function(error, response, body) {
        t.type(error, Error, 'expect an error');
        t.match(error.message, 'No match for request');
        t.end();
      });
    });
  });
});
