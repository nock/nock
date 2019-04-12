'use strict'

const { test } = require('tap')
const fetch = require('isomorphic-fetch')
const nock = require('..')

require('./cleanup_after_each')()

test('basic match works', function(t) {
  const scope = nock('http://example.test')
    .get('/path')
    .reply(200, 'somedata')

  fetch('http://example.test/path')
    .then(function(res) {
      return res.text()
    })
    .then(function(text) {
      scope.done()
      t.equal(text, 'somedata', 'response should match')
      t.end()
    })
    .catch(function(err) {
      throw err
    })
})

test('string-based reqheaders match works', function(t) {
  const scope = nock('http://example.test', {
    reqheaders: {
      header: 'header value',
    },
  })
    .get('/path2')
    .reply(200, 'somemoardata')

  return fetch('http://example.test/path2', {
    headers: {
      header: 'header value',
    },
  })
    .then(function(res) {
      return res.text()
    })
    .then(function(text) {
      scope.done()
      t.equal(text, 'somemoardata', 'response should match')
      t.end()
    })
    .catch(function(err) {
      throw err
    })
})

test('basicAuth match works', function(t) {
  const scope = nock('http://example.test')
    .get('/path2')
    .basicAuth({
      user: 'username',
      pass: 'password',
    })
    .reply(200, 'somemoardata')

  return fetch('http://example.test/path2', {
    headers: {
      Authorization: `Basic ${Buffer.from('username:password').toString(
        'base64'
      )}`,
    },
  })
    .then(function(res) {
      return res.text()
    })
    .then(function(text) {
      scope.done()
      t.equal(text, 'somemoardata', 'response should match')
      t.end()
    })
    .catch(function(err) {
      throw err
    })
})

test('matchHeader works', function(t) {
  const authorizationHeader = `Basic ${Buffer.from(
    'username:password'
  ).toString('base64')}`

  const scope = nock('http://example.test')
    .get('/path2')
    .matchHeader('authorization', authorizationHeader)
    .reply(200, 'somemoardata')

  return fetch('http://example.test/path2', {
    headers: {
      Authorization: authorizationHeader,
    },
  })
    .then(function(res) {
      return res.text()
    })
    .then(function(text) {
      scope.done()
      t.equal(text, 'somemoardata', 'response should match')
      t.end()
    })
    .catch(function(err) {
      throw err
    })
})
