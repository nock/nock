var nock    = require('../.')
  , tap     = require('tap')
  , http    = require('http');

tap.test('records', function(t) {
  nock.restore();
  var cb1 = false
    , options = { method: 'POST'
                , host:'expensecat.iriscouch.com'
                , port:80
                , path:'/' }
  ;

  nock.recorder.rec(true);
  var req = http.request(options, function(res) {
    cb1 = true
    var ret;
    res.once('end', function() {
      nock.restore();
      ret = nock.recorder.play();
      t.equal(ret.length, 1);
      t.equal(ret[0].indexOf("\nnock('expensecat.iriscouch.com')\n  .post('/'\"ABCDEF\")\n  .reply("), 0);
      t.end();
    });
  });
  req.write('ABCDEF');
  req.end();
  return req;
});