'use strict';

const tap = require('tap');
const nock = require('../../');

/**
 * Run common test suite against an HTTP client library.
 *
 * The makeRequest fn should be a wrapper around an
 * HTTP client, which maps our arguments to those accepted by the client.
 *
 * The client is expected to accept an options object with props:
 * - uri
 * - method
 * - timeout
 * And return a promise, which in success has properties
 * - statusCode (number)
 * - body (string)
 * And in failure is a standard error object.
 *
 * @param {Function} makeRequest Request fn
 * @param {string} name Lib we're testing
 */
const runCommonTests = (makeRequest, name) => {
  const test = (description, cb) => {
    return tap.test(`${name}: ${description}`, cb);
  };

  test('basic intercept', (t) => {
    nock('http://www.example.com')
      .get('/')
      .reply(200, 'OK');

    return makeRequest({
        uri: 'www.example.com'
      })
      .then((res) => {
        t.equal(res.statusCode, 200);
        t.deepEqual(res.body, 'OK');

        t.end();
      })
      .catch(t.threw);
  });

  test('scope#socketDelay', (t) => {
    const timeout = 100;
    nock('http://www.example.com')
      .get('/')
      .socketDelay(timeout)
      .reply(200, 'OK');

    return makeRequest({
        uri: 'www.example.com',
        timeout: timeout / 2
      })
      .then((res) => {
        const code = res.statusCode;
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
      })
      .catch(t.threw);
  });
};

module.exports = {
  runCommonTests
};
