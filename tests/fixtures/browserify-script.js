var assert = require('assert');
var http = require('http');
var nock = require('../../');

nock.disableNetConnect();
nock('http://browserifyland.com').get('/beep').reply(200, 'boop');

http.get('http://browserifyland.com/beep', function(res) {
  res.setEncoding('utf8');
  var body = '';
  res
    .on('data', function(d) {
      body += d;
    })
    .once('end', function() {
      assert.equal(body, 'boop');
      document.getElementById('content').innerHTML = body;
    });
});