var nock    = require('../.')
  , tap     = require('tap')
  , http    = require('http');

tap.test('records', function(t) {
  nock.restore();
  var cb1 = false
    , options = { method: 'POST'
                , host:'google.com'
                , port:80
                , path:'/' }
  ;

  nock.recorder.rec(true);
  var req = http.request(options, function(res) {
    res.resume();
    cb1 = true
    var ret;
    res.once('end', function() {
      nock.restore();
      ret = nock.recorder.play();
      t.equal(ret.length, 1);
      t.equal(ret[0].indexOf("\nnock('http://google.com')\n  .post('/', \"ABCDEF\")\n  .reply("), 0);
      t.end();
    });
  });
  req.end('ABCDEF');
  return req;
});


tap.test('checks if callback is specified', function(t) {
  var options = {
    host: 'www.google.com', method: 'GET', path: '/', port: 80
  };

  nock.restore();
  nock.recorder.rec(true);

  http.request(options, undefined).end();
  t.end();
});
