'use strict';

const popsicle = require('popsicle');
const common = require('../common');

const makeRequest = (options) => {
  return popsicle.request({
    url: options.uri,
    method: options.method || 'GET'
  })
  .then((res) => {
    res.statusCode = res.status;

    return res;
  })
};

common.runCommonTests(makeRequest, 'popsicle@latest');
