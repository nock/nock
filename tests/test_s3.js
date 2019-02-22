'use strict'

// This is a regression test for this change:
// https://github.com/nock/nock/commit/8f303b2a1e5ac00429f1d9e252dd52c52e65987b
//
// It should be replaced by a small test which reproduces the specific issue.
// See discussion: https://github.com/nock/nock/pull/1288
//
// Do not create new tests in this style.

const AWS = require('aws-sdk')
const { test } = require('tap')
const nock = require('..')

require('./cleanup_hook')()

test('works with s3, body < 1024 ^ 2', function(t) {
  const REGION = 'us-east-1'

  AWS.config.update({
    region: REGION,
    sslEnabled: true,
    accessKeyId: 'ACCESSKEYID',
    secretAccessKey: 'SECRETACCESSKEY',
  })

  const bucket = new AWS.S3({
    apiVersion: '2006-03-01',
    params: {
      Bucket: 'bucket',
    },
  })

  nock('https://bucket.s3.amazonaws.com')
    .put('/key')
    .reply(200)

  bucket.putObject(
    {
      Key: 'key',
      Body: Buffer.alloc(1024 * 1024 - 1), // works
      // Body: new Buffer(1024 * 1024), // doesn't work
      ContentType: 'binary/octet-stream',
    },
    function(err, resp) {
      if (err) throw err
      t.deepEqual(resp, {})
      t.end()
    }
  )
})

test('works with s3, body = 10 * 1024 ^ 2', function(t) {
  const REGION = 'us-east-1'

  AWS.config.update({
    region: REGION,
    sslEnabled: true,
    accessKeyId: 'ACCESSKEYID',
    secretAccessKey: 'SECRETACCESSKEY',
  })

  const bucket = new AWS.S3({
    apiVersion: '2006-03-01',
    params: {
      Bucket: 'bucket',
    },
  })

  nock('https://bucket.s3.amazonaws.com')
    .put('/key')
    .reply(200)

  bucket.putObject(
    {
      Key: 'key',
      Body: Buffer.alloc(10 * 1024 * 1024), // doesn't work
      ContentType: 'binary/octet-stream',
    },
    function(err, resp) {
      if (err) throw err
      t.deepEqual(resp, {})
      t.end()
    }
  )
})

test('works with s3, body = 16 * 1024 ^ 2', function(t) {
  const REGION = 'us-east-1'

  AWS.config.update({
    region: REGION,
    sslEnabled: true,
    accessKeyId: 'ACCESSKEYID',
    secretAccessKey: 'SECRETACCESSKEY',
  })

  const bucket = new AWS.S3({
    apiVersion: '2006-03-01',
    params: {
      Bucket: 'bucket',
    },
  })

  nock('https://bucket.s3.amazonaws.com')
    .put('/key')
    .reply(200)

  bucket.putObject(
    {
      Key: 'key',
      Body: Buffer.alloc(16 * 1024 * 1024), // doesn't work
      ContentType: 'binary/octet-stream',
    },
    function(err, resp) {
      if (err) throw err
      t.deepEqual(resp, {})
      t.end()
    }
  )
})
