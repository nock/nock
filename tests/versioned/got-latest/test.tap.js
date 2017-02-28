'use strict';

const tap = require('tap');
const got = require('got');
const nock = require('../../../');

tap.test('basic intercept', (t) => {
  nock('http://www.example.com')
    .get('/')
    .reply(200, 'OK');

  got('www.example.com')
    .then((response) => {
      t.equal(response.statusCode, 200);
      t.deepEqual(response.body, 'OK');

      t.end();
    })
    .catch((err) => {
      t.fail(err.message);
      t.end();
    })
});

tap.test('scope#socketDelay', (t) => {
  const timeout = 500;
  nock('http://www.example.com')
    .get('/')
    .socketDelay(timeout)
    .reply(200, 'OK');

  got('www.example.com', { timeout: timeout - 100 })
    .then((response) => {
      const code = response.statusCode;
      const err = code === 200
        ? new Error('Unexpected success')
        : new Error(`Unexpected failure (${code})`);

      throw err;
    })
    .catch((error) => {
      if (error.message.match('Unexpected')) {
        t.fail(`No timeout: ${error.message}`);
      }

      t.end();
    });
});
