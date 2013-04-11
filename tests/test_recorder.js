var nock    = require('../.')
  , tap     = require('tap')
  , http    = require('http');

tap.test('records', function(t) {
  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);
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
      t.type(ret[0], 'string');
      t.equal(ret[0].indexOf("\nnock('http://google.com')\n  .post('/', \"ABCDEF\")\n  .reply("), 0);
      t.end();
    });
  });
  req.end('ABCDEF');
});


tap.test('checks if callback is specified', function(t) {
  var options = {
    host: 'www.google.com', method: 'GET', path: '/', port: 80
  };

  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);
  nock.recorder.rec(true);

  http.request(options).end();
  t.end();
});

tap.test('when request body is json, it goes unstringified', function(t) {
  var payload = {a: 1, b: true};
  var options = {
    method: 'POST',
    host: 'www.google.com',
    path: '/', port: 80
  };

  nock.restore();
  nock.recorder.clear();
  nock.recorder.rec(true);

  var request = http.request(options, function(res) {
    res.resume();
    res.once('end', function() {
      ret = nock.recorder.play();
      t.ok(ret.length >= 1);
      ret = ret[1] || ret[0];
      t.equal(ret.indexOf("\nnock('http://www.google.com')\n  .post('/', {\"a\":1,\"b\":true})\n  .reply("), 0);
      t.end();
    })
  });

  request.end(JSON.stringify(payload));
});