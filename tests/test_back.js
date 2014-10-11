
var nockBack = require('../.').back
  , tap     = require('tap')
  , http    = require('http')
  , fs      = require('fs')
  , exists  = fs.existsSync;

var originalMode = nockBack.currentMode;

tap.test('nockBack tests', function (nw) {
  nockBack.setMode('record');

  nw.test('nockBack throw an execption when fixtures is not set', function (t) {

    try {
      nockBack();
    } catch (e) {
      t.ok(true, 'excpected exception');
      t.end();
      return;
    }

    t.fail(true, false, 'test should have ended');

  });

  nw.test('it records when configured correctly', function (t) {
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
  nw.test('it can record twice', function (t) {
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
        t.equal(err.message, 'Nock: Not allow net connect for "www.amazon.com:80"');
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

  nw.end();
})
.on('end', function () {

  nockBack.setMode(originalMode);

});
