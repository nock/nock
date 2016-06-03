'use strict';

var test     = require('tap').test;
var nock = require('../');
var nockBack = nock.back;
var rimraf = require('rimraf');
var aws = require('aws-sdk');
var s3 = new aws.S3();

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
  fixture = nockBack.fixtures + '/recording_test.json';
  rimraf.sync(fixture);

  nockBack.setMode("record");
  t.end();
});


var out1 = [];
var out2 = [];


test('record', function(t) {
  nockBack('recording_test.json', function(nockDone) {
    s3.getObject({
      Bucket: 'BUCKET_NAME',
      Key: 'KEY_NAME'
    }).createReadStream().on('data', function(buffer) {
      out1.push(buffer);
    }).on('end',function(){
      nockDone();
      t.end();
    });
  });
});

test('replay', function(t) {
  nockBack('recording_test.json', function(nockDone) {
    s3.getObject({
      Bucket: 'BUCKET_NAME',
      Key: 'KEY_NAME'
    }).createReadStream().on('data', function(buffer) {
      out2.push(buffer);
    }).on('end', function(){
      out1 = Buffer.concat(out1);
      out2 = Buffer.concat(out2);
      t.equal(out1.length, out2.length);
      nockDone();
      t.end();
    });
  });
  rimrafOnEnd(t);
});

test('teardown', function(t) {
  nockBack.setMode(originalMode);
  t.end();
});
