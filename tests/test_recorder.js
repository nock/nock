var nock    = require('../.')
  , tap     = require('tap')
  , http    = require('http')
  , https   = require('https')
  , _       = require('lodash');

tap.test('recording turns off nock interception (backward compatibility behavior)', function(t) {

  //  We ensure that there are no overrides.
  nock.restore();
  //  We active the nock overriding - as it's done by merely loading nock.
  nock.activate();
  //  We start recording.
  nock.recorder.rec();
  //  Nothing happens - which was the original behavior.
  t.ok(true);

  t.end();

});

tap.test('records', function(t) {
  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);
  var options = { method: 'POST'
                , host:'google.com'
                , port:80
                , path:'/' }
  ;

  nock.recorder.rec(true);
  var req = http.request(options, function(res) {
    res.resume();
    var ret;
    res.once('end', function() {
      nock.restore();
      ret = nock.recorder.play();
      t.equal(ret.length, 1);
      t.type(ret[0], 'string');
      t.equal(ret[0].indexOf("\nnock('http://google.com:80')\n  .post('/', \"ABCDEF\")\n  .reply("), 0);
      t.end();
    });
  });
  req.end('ABCDEF');
});

tap.test('records objects', function(t) {
  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);
  var options = { method: 'POST'
                , host:'google.com'
                , path:'/' }
  ;

  nock.recorder.rec({
    dont_print: true,
    output_objects: true
  });
  var req = http.request(options, function(res) {
    res.resume();
    var ret;
    res.once('end', function() {
      nock.restore();
      ret = nock.recorder.play();
      t.equal(ret.length, 1);
      var ret = ret[0];
      t.type(ret, 'object');
      t.equal(ret.scope, "http://google.com:80");
      t.equal(ret.method, "POST");
      t.ok(typeof(ret.status) !== 'undefined');
      t.ok(typeof(ret.response) !== 'undefined');
      t.end();
    });
  });
  req.end('012345');
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
    path: '/',
    port: 80
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
      t.equal(ret.indexOf("\nnock('http://www.google.com:80')\n  .post('/', {\"a\":1,\"b\":true})\n  .reply("), 0);
      t.end();
    });
  });

  request.end(JSON.stringify(payload));
});

tap.test('when request body is json, it goes unstringified in objects', function(t) {
  var payload = {a: 1, b: true};
  var options = {
    method: 'POST',
    host: 'www.google.com',
    path: '/',
    port: 80
  };

  nock.restore();
  nock.recorder.clear();
  nock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var request = http.request(options, function(res) {
    res.resume();
    res.once('end', function() {
      ret = nock.recorder.play();
      t.ok(ret.length >= 1);
      ret = ret[1] || ret[0];
      t.type(ret, 'object');
      t.equal(ret.scope, "http://www.google.com:80");
      t.equal(ret.method, "POST");
      t.ok(ret.body && ret.body.a && ret.body.a === payload.a && ret.body.b && ret.body.b === payload.b);
      t.ok(typeof(ret.status) !== 'undefined');
      t.ok(typeof(ret.response) !== 'undefined');
      t.end();
    });
  });

  request.end(JSON.stringify(payload));
});

tap.test('records nonstandard ports', function(t) {
  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);

  var REQUEST_BODY = 'ABCDEF';
  var RESPONSE_BODY = '012345';

  //  Create test http server and perform the tests while it's up.
  var testServer = http.createServer(function (req, res) {
    res.write(RESPONSE_BODY);
    res.end();
  }).listen(8081, function(err) {

    t.equal(err, undefined);

    var options = { host:'localhost'
                  , port:testServer.address().port
                  , path:'/' }
    ;

    var rec_options = {
      dont_print: true,
      output_objects: true
    };

    nock.recorder.rec(rec_options);

    var req = http.request(options, function(res) {
      res.resume();
      res.once('end', function() {
        nock.restore();
        var ret = nock.recorder.play();
        t.equal(ret.length, 1);
        ret = ret[0];
        t.type(ret, 'object');
        t.equal(ret.scope, "http://localhost:" + options.port);
        t.equal(ret.method, "GET");
        t.equal(ret.body, REQUEST_BODY);
        t.equal(ret.status, 200);
        t.equal(ret.response, RESPONSE_BODY);
        t.end();

        //  Close the test server, we are done with it.
        testServer.close();
      });
    });

    req.end(REQUEST_BODY);
  });

});

tap.test('rec() throws when reenvoked with already recorder requests', function(t) {
  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);

  nock.recorder.rec();
  try {
    nock.recorder.rec();
    //  This line should never be reached.
    t.ok(false);
    t.end();
  } catch(e) {
    t.equal(e.toString(), 'Error: Nock recording already in progress');
    t.end();
  }
});

tap.test('records https correctly', function(t) {
  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);

  var options = { method: 'POST'
                , host:'google.com'
                , path:'/' }
  ;

  nock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var req = https.request(options, function(res) {
    res.resume();
    var ret;
    res.once('end', function() {
      nock.restore();
      ret = nock.recorder.play();
      t.equal(ret.length, 1);
      ret = ret[0];
      t.type(ret, 'object');
      t.equal(ret.scope, "https://google.com:80");
      t.equal(ret.method, "POST");
      t.ok(typeof(ret.status) !== 'undefined');
      t.ok(typeof(ret.response) !== 'undefined');
      t.end();
    });
  });
  req.end('012345');
});

tap.test('records request headers correctly', function(t) {
  nock.restore();
  nock.recorder.clear();
  t.equal(nock.recorder.play().length, 0);

  nock.recorder.rec({
    dont_print: true,
    output_objects: true
  });

  var req = http.request({
      hostname: 'www.example.com',
      path: '/',
      method: 'GET',
      auth: 'foo:bar'
    }, function(res) {
      res.resume();
      res.once('end', function() {
        nock.restore();
        var ret = nock.recorder.play();
        t.equal(ret.length, 1);
        ret = ret[0];
        t.type(ret, 'object');
        t.true(_.isEqual(ret.reqheaders, {
          host: 'www.example.com',
          'authorization': 'Basic Zm9vOmJhcg=='
        }));
        t.end();
      });
    }
  );
  req.end();
});
