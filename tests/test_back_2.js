'use strict';

var test = require('tap').test;
var nock = require('../');
var nockBack = nock.back;
var http = require("http");
var rimraf = require('rimraf');
var fs = require('fs');

var originalMode;
var fixture;

function rimrafOnEnd(t) {
  t.once('end', function() {
    rimraf.sync(fixture);
  });
}

test('setup', function(t) {
  originalMode = nockBack.currentMode;

  nock.enableNetConnect();
  nockBack.fixtures = __dirname + "/fixtures";
  fixture = nockBack.fixtures + '/recording_test.json'
  rimraf.sync(fixture);

  nockBack.setMode("record");
  t.end();
});

test('recording', function(t) {
  t.plan(5)

  nockBack('recording_test.json', function(nockDone) {
    const server = http.createServer((request, response) => {
        t.pass('server received a request')

        response.writeHead(301)
        response.write('server served a response')
        response.end()
      })

    server.listen(() => {
        const request = http.request({
          host: 'localhost',
          path: '/',
          port: server.address().port,
          method: 'GET'
        }, (response) => {
          response.once('end', () => {
            nockDone()

            let fixtureContent = JSON.parse(fs.readFileSync(fixture, {encoding: 'utf8'}))

            t.equal(fixtureContent.length, 1)
            fixtureContent = fixtureContent[0]
            t.equal(fixtureContent.method, 'GET')
            t.equal(fixtureContent.path, '/')
            t.ok(fixtureContent.status == 301)

            server.close(t.end)
          })

          response.resume()
        })

        request.on('error', t.error)
        request.end()
      })
  })

  rimrafOnEnd(t)
})

test('passes custom options to recorder', function(t) {
  t.plan(3)

  nockBack('recording_test.json', { recorder: { enable_reqheaders_recording: true } }, function(nockDone) {
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
          port: server.address().port,
          method: 'GET'
        }, (response) => {
          response.once('end', () => {
            nockDone()

            let fixtureContent = JSON.parse(fs.readFileSync(fixture, {encoding: 'utf8'}));

            t.equal(fixtureContent.length, 1);
            fixtureContent = fixtureContent[0];
            t.ok(fixtureContent.reqheaders);

            server.close(t.end)
          })

          response.resume()
        })

        request.on('error', t.error)
        request.end()
      })
  })

  rimrafOnEnd(t);
})

test('teardown', function(t) {
  nockBack.setMode(originalMode);
  t.end();
});
