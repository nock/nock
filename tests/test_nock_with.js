
var nockWith = require('../.').nockWith
  , tap     = require('tap')
  , http    = require('http')
  , fs      = require('fs')
  , exists  = fs.existsSync;


tap.test('nockWith throw an execption when fixtures is not set', function (t) {

  try {
    nockWith();
  } catch (e) {
    t.ok(true, 'excpected exception');
    t.end();
    return;
  }

  t.fail(true, false, 'test should have ended');

});

tap.test('it records when configured correctly', function (t) {
  nockWith.fixtures = __dirname + '/fixtures';

  var options = {
    host: 'www.google.com', method: 'GET', path: '/', port: 80
  };

  var fixture = 'someFixture.json';
  var fixtureLoc = nockWith.fixtures + '/' + fixture;

  t.false(exists(fixtureLoc));

  nockWith(fixture, function (done) {
    http.request(options).end();
    done();

    t.true(exists(fixtureLoc));

    fs.unlinkSync(fixtureLoc);
    t.end();
  });

});

//Adding this test because there was an issue when not calling
//nock.activate() after calling nock.restore()
tap.test('it can record twice', function (t) {

  nockWith.fixtures = __dirname + '/fixtures';

  var options = {
    host: 'www.google.com', method: 'GET', path: '/', port: 80
  };
  var fixture = 'someFixture2.json';
  var fixtureLoc = nockWith.fixtures + '/' + fixture;
  t.false(exists(fixtureLoc));

  nockWith(fixture, function (done) {
    http.request(options).end();
    done();

    t.true(exists(fixtureLoc));

    fs.unlinkSync(fixtureLoc);
    t.end();
  });

});


tap.test('it shouldn\'t allow outside calls', function (t) {

  var fixture = 'wrongUri.json';

  nockWith(fixture, function (done) {

    http.get('http://www.amazon.com', function(res) {
      throw "should not request this";
    }).on('error', function(err) {
      t.equal(err.message, 'Nock: Not allow net connect for "www.amazon.com:80"');
      done();
      t.end();
    });

  });

});


tap.test('it loads your recorded tests', function (t) {

  nockWith('goodRequest.json', function (done) {
    t.true(this.scopes.length > 0);
    done();
    t.end();
  });

});

