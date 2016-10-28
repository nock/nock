var zlib = require('zlib');
var nock = require('../.');
var http = require('http');
var test = require('tap').test;

test('accepts gzipped content', {skip: !zlib.gzipSync | !zlib.gunzipSync}, function(t) {
  var message = 'Lorem ipsum dolor sit amet';

  var compressedMessage = zlib.gzipSync(message);

  nock('http://gziplandpartywoo')
    .get('/foo')
    .reply(200, compressedMessage, {
      'X-Transfer-Length': String(compressedMessage.length),
      'Content-Length': undefined,
      'Content-Encoding': 'gzip',
    });

  http.get('http://gziplandpartywoo/foo', function(res) {
    res.once('data', function(d) {
      var dd = zlib.gunzipSync(d);
      t.equal(dd.toString(), message);
      res.once('end', t.end.bind(t));
    });
  });
});
