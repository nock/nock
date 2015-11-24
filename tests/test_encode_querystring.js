var nock    = require('../.');
var request = require('request');
var test    = require('tap').test;

test('encode query string', function(t) {
  var query1 = { q: '(nodejs)' };

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
    t.end();
  });
});
