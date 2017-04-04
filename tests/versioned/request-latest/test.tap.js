'use strict';

const tap = require('tap');
const request = require('request');
const common = require('../common');

const makeRequest = (options) => {
  return new Promise((resolve, reject) => {
    request({
      uri: options.uri,
      method: options.method || 'GET'
    }, (err, res, body) => {
      if (err) { return reject(err); }

      res.body = body;
      resolve(res);
    });
  });
};

common.runCommonTests(makeRequest, 'request@latest');
