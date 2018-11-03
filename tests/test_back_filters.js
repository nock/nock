'use strict';
const test = require('tap').test;
const nock = require('../');
const nockBack = nock.back;
const http = require('http');
const rimraf = require('rimraf');
const fs = require('fs');


const originalMode = nockBack.currentMode;
nock.enableNetConnect();
nockBack.fixtures = __dirname + "/fixtures";
nockBack.setMode('record');
const fixture = nockBack.fixtures + '/recording_test.json'


function rimrafOnEnd(t) {
  t.once('end', function() {
    rimraf.sync(fixture);
  });
}

function createRequest(options, callback) {
  const baseOptions = {
    host: 'localhost',
    path: '/',
    method: 'GET'
  };
  const request = http.request(Object.assign({}, baseOptions, options), (response) => {
    let rawData = '';
    response.on('data', (chunk) => rawData += chunk);
    response.once('end', () => {
      callback(rawData);
      response.resume();
    });
  });
  return request;
}

test('nockBack passes filteringPath options', function(t) {
  t.plan(5);

  const nockBackOptions = {
    before(scope) {
      scope.filteringPath = (path) => {
        let filteredPath = path;
        filteredPath = path.replace(/timestamp=[0-9]+/, 'timestamp=1111');
        return filteredPath;
      };
    }
  };
  const server = http.createServer((request, response) => {
    t.pass('server received a request');

    response.writeHead(200);
    response.write(`server served a response at ${new Date()}`)
    response.end();
  });

  server.listen(() => {
    const { port } = server.address();

    nockBack('recording_test.json', nockBackOptions, function(nockDone) {
      const requestForRecord = createRequest({
        path: '/?timestamp=1111',
        port
      }, (firstRawData) => {
        nockDone();
        t.pass('nockBack regords fixture');

        let fixtureContent = JSON.parse(fs.readFileSync(fixture, { encoding: 'utf8' }));
        t.equal(fixtureContent.length, 1);
        fixtureContent = fixtureContent[0];
        t.equal(fixtureContent.path, '/?timestamp=1111');

        nockBack('recording_test.json', nockBackOptions, function(nockDone) {
          const request = createRequest({
            path: '/?timestamp=2222',
            port
          }, (secondRawData) => {
            nockDone();

            t.equal(firstRawData, secondRawData);

            server.close(t.end)
          });

          request.on('error', t.error);
          request.end();
        });
      });

      requestForRecord.on('error', t.error);
      requestForRecord.end();
    });
  });

  rimrafOnEnd(t);
});


test('teardown', function(t) {
  nockBack.setMode(originalMode);
  t.end();
});
