'use strict';

const got = require('got');
const common = require('../common');

const makeRequest = (options) => {
  return got(options.uri, {
    method: options.method,
    timeout: options.timeout
  });
};

common.runCommonTests(makeRequest, 'got@latest');
