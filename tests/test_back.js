'use strict';

var nock    = require('../.')
  , nockBack= nock.back
  , tap     = require('tap')
  , http    = require('http')
  , fs      = require('fs')
  , exists  = fs.existsSync
  , _       = require('lodash');

nock.enableNetConnect();

var originalMode = nockBack.currentMode;

function testNock (t) {
  var dataCalled = false;

  var scope = nock('http://www.google.com')
    .get('/')
    .reply(200, "Hello World!");

  var req = http.request({
      host: "www.google.com"
    , path: '/'
    , port: 80
    }, function(res) {

      t.equal(res.statusCode, 200);
      res.once('end', function() {
          t.ok(dataCalled);
          scope.done();
          t.end();
        });
      res.on('data', function(data) {
          dataCalled = true;
          t.ok(data instanceof Buffer, "data should be buffer");
          t.equal(data.toString(), "Hello World!", "response should match");
        });
    });

  req.end();
}

function nockBackWithFixture (t, scopesLoaded) {
  var scopesLength = scopesLoaded ? 1 : 0;

  nockBack('goodRequest.json', function (done) {
    t.true(this.scopes.length === scopesLength);
    http.get('http://www.google.com').end();
    this.assertScopesFinished();
    done();
    t.end();
  });
}

// this is a temporary as we get rid of all the {skip: process.env.AIRPLANE}
// settings. When we are done with all, replace nockBackWithFixture and get
// rid of this function and the goodRequestLocalhost.json fixtures
function nockBackWithFixtureLocalhost (t, scopesLoaded) {
  const scopesLength = scopesLoaded ? 1 : 0;

  nockBack('goodRequestLocalhost.json', function (done) {
    t.equals(this.scopes.length, scopesLength);

    const server = http.createServer((request, response) => {
      t.pass('server received a request');

      response.writeHead(200);
      response.end();
    });

    server.listen(() => {
      const request = http.request({
        host: 'localhost',
        path: '/',
        port: server.address().port
      }, response => {
        t.is(200, response.statusCode);
        this.assertScopesFinished();
        done();
        server.close(t.end);
      });

      request.on('error', t.error);
      request.end();
    });
  });
}

function setOriginalModeOnEnd(t, nockBack) {
  t.once('end', function() {
    nockBack.setMode(originalMode);
  });
}

tap.test('nockBack throws an exception when fixtures is not set', function (t) {

  try {
    nockBack();
  } catch (e) {
    t.ok(true, 'excpected exception');
    t.end();
    return;
  }

  t.fail(true, false, 'test should have ended');

});

tap.test('nockBack throws an exception when fixtureName is not a string', function (t) {

  nockBack.fixtures = __dirname + '/fixtures';

  try {
    nockBack();
  } catch (e) {
    t.ok(true, 'excpected exception');
    t.equal(e.message, 'Parameter fixtureName must be a string');
    t.end();
    return;
  }

  t.fail(true, false, 'test should have ended');

});

tap.test('nockBack returns a promise when neither options nor nockbackFn are specified', function (t) {

  nockBack.fixtures = __dirname + '/fixtures';

  var promise = nockBack('test-promise-fixture.json');
  t.ok(promise);
  promise.then((params) => {
    var nockDone = params.nockDone;
    var context = params.context;
    t.assert(_.isFunction(nockDone));
    t.assert(_.isObject(context));
    t.end();
  });

});

tap.test('nockBack returns a promise when nockbackFn is not specified', function (t) {

  nockBack.fixtures = __dirname + '/fixtures';

  var promise = nockBack('test-promise-fixture.json', {test: 'options'});
  t.ok(promise);
  promise.then((params) => {
    var nockDone = params.nockDone;
    var context = params.context;
    t.assert(_.isFunction(nockDone));
    t.assert(_.isObject(context));
    t.end();
  });

});

tap.test('nockBack wild tests', function (nw) {

  //  Manually disable net connectivity to confirm that dryrun enables it.
  nock.disableNetConnect();

  nockBack.fixtures = __dirname + '/fixtures';
  nockBack.setMode('wild');

  nw.test('normal nocks work', function (t) {
    testNock(t);
  });

  nw.test('nock back doesn\'t do anything', function (t) {
    nockBackWithFixtureLocalhost(t, false);
  });

  setOriginalModeOnEnd(nw, nockBack);

  nw.end();
});

tap.test('nockBack dryrun tests', function (nw) {

  //  Manually disable net connectivity to confirm that dryrun enables it.
  nock.disableNetConnect();

  nockBack.fixtures = __dirname + '/fixtures';
  nockBack.setMode('dryrun');

  nw.test('goes to internet even when no nockBacks are running', function(t) {

    t.plan(2);

    const server = http.createServer((request, response) => {
      t.pass('server received a request');

      response.writeHead(200);
      response.end();
    });

    server.listen(() => {
      const request = http.request({
        host: 'localhost',
        path: '/',
        port: server.address().port
      }, response => {
        t.is(200, response.statusCode);

        server.close(t.end);
      });

      request.on('error', t.error);
      request.end();
    });

  });

  nw.test('normal nocks work', function (t) {
    testNock(t);
  });

  nw.test('uses recorded fixtures', function (t) {
    nockBackWithFixture(t, true);
  });

  nw.test('goes to internet, doesn\'t record new fixtures', function (t) {

    t.plan(5)

    let dataCalled = false

    const fixture = 'someDryrunFixture.json'
    const fixtureLoc = nockBack.fixtures + '/' + fixture

    t.false(exists(fixtureLoc))

    nockBack(fixture, function (done) {
      const server = http.createServer((request, response) => {
        t.pass('server received a request')

        response.writeHead(200)
        response.write('server served a response')
        response.end()
      })

      server.listen(() => {
        const request = http.request({
          host: 'localhost',
          path: '/',
          port: server.address().port
        }, (response) => {
          t.is(200, response.statusCode)

          response.on('data', (data) => {
            dataCalled = true
          })

          response.on('end', () => {
            t.ok(dataCalled)
            t.false(exists(fixtureLoc))

            server.close(t.end)
          })
        })

        request.on('error', t.error)
        request.end()
      })
    })

  })

  setOriginalModeOnEnd(nw, nockBack);

  nw.end();
});

tap.test('nockBack record tests', function (nw) {
  nockBack.setMode('record');

  nw.test('it records when configured correctly', {skip: process.env.AIRPLANE}, function (t) {
    nockBack.fixtures = __dirname + '/fixtures';

    var options = {
      host: 'www.google.com', method: 'GET', path: '/', port: 80
    };

    var fixture = 'someFixture.json';
    var fixtureLoc = nockBack.fixtures + '/' + fixture;

    t.false(exists(fixtureLoc));

    nockBack(fixture, function (done) {
      http.request(options).end();
      done();

      t.true(exists(fixtureLoc));

      fs.unlinkSync(fixtureLoc);
      t.end();
    });

  });

  //Adding this test because there was an issue when not calling
  //nock.activate() after calling nock.restore()
  nw.test('it can record twice', {skip: process.env.AIRPLANE}, function (t) {
    nockBack.fixtures = __dirname + '/fixtures';

    var options = {
      host: 'www.google.com', method: 'GET', path: '/', port: 80
    };
    var fixture = 'someFixture2.json';
    var fixtureLoc = nockBack.fixtures + '/' + fixture;
    t.false(exists(fixtureLoc));

    nockBack(fixture, function (done) {
      http.request(options).end();
      done();

      t.true(exists(fixtureLoc));

      fs.unlinkSync(fixtureLoc);
      t.end();
    });

  });

  nw.test('it shouldn\'t allow outside calls', function (t) {

    var fixture = 'wrongUri.json';

    nockBack(fixture, function (done) {

      http.get('http://www.amazon.com', function(res) {
        throw "should not request this";
      }).on('error', function(err) {
        t.equal(err.message, 'Nock: Not allow net connect for "www.amazon.com:80/"');
        done();
        t.end();
      });

    });

  });

  nw.test('it loads your recorded tests', function (t) {

    nockBack('goodRequest.json', function (done) {
      t.true(this.scopes.length > 0);
      http.get('http://www.google.com').end();
      this.assertScopesFinished();
      done();
      t.end();
    });

  });

  nw.test('it can filter after recording', {skip: process.env.AIRPLANE}, function (t) {
    nockBack.fixtures = __dirname + '/fixtures';

    var options = {
      host: 'www.google.com', method: 'GET', path: '/', port: 80
    };

    var fixture = 'filteredFixture.json';
    var fixtureLoc = nockBack.fixtures + '/' + fixture;

    t.false(exists(fixtureLoc));

    var afterRecord = function(scopes) {
       // You would do some filtering here, but for this test we'll just return an empty array
      return [];
    }

    nockBack(fixture, {afterRecord: afterRecord}, function (done) {
      http.request(options).end();
      done();

      t.true(exists(fixtureLoc));

      nockBack(fixture, function (done) {
        t.true(this.scopes.length === 0);
        done();

        fs.unlinkSync(fixtureLoc);
        t.end();
      });
    });
  });

  nw.end();

  setOriginalModeOnEnd(nw, nockBack);
});

tap.test('nockBack lockdown tests', function (nw) {
  nockBack.fixtures = __dirname + '/fixtures';
  nockBack.setMode('lockdown');

  nw.test('normal nocks work', function (t) {
    testNock(t);
  });

  nw.test('nock back loads scope', function (t) {
    nockBackWithFixture(t, true);
  });

  nw.test('no unnocked http calls work', function (t) {
    var req = http.request({
        host: "google.com"
      , path: '/'
      }, function(res) {
        throw new Error('should not come here!');
      });

    req.on('error', function (err) {
      t.equal(err.message.trim(), 'Nock: Not allow net connect for "google.com:80/"');
      t.end();
    });

    req.end();
  });

  setOriginalModeOnEnd(nw, nockBack);

  nw.end();
});
