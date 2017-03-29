'use strict';

var deepEqual = require('deep-equal');
var qs = require('querystring');

module.exports =
function matchBody(spec, body) {
  if (typeof spec === 'undefined') {
    return true;
  }
  var options = this || {};

  if (Buffer.isBuffer(body)) {
    body = body.toString();
  }

  var contentType = options.headers && (options.headers['Content-Type'] ||
                                        options.headers['content-type']);

  var isMultipart = contentType && contentType.toString().match(/multipart/);

  //strip line endings from both so that we get a match no matter what OS we are running on
  //if Content-Type does not contains 'multipart'
  if (!isMultipart && typeof body === "string") {
    body = body.replace(/\r?\n|\r/g, '');
  }

  if (spec instanceof RegExp) {
    return body.match(spec);
  }

  if (!isMultipart && typeof spec === "string") {
    spec = spec.replace(/\r?\n|\r/g, '');
  }

  // try to transform body to json
  var json;
  if (typeof spec === 'object' || typeof spec === 'function') {
    try { json = JSON.parse(body);} catch(err) {}
    if (json !== undefined) {
      body = json;
    } else {
      if (contentType && contentType.toString().match(/application\/x-www-form-urlencoded/)) {
        body = qs.parse(body);
      }
    }
  }

  if (typeof spec === "function") {
    return spec.call(this, body);
  }

  return deepEqualExtended(spec, body);
};

function deepEqualExtended(spec, body) {
  if (spec && spec.constructor === RegExp) {
    return spec.test(body);
  }
  if (spec && (spec.constructor === Object || spec.constructor === Array) && body) {
    var keys = Object.keys(spec);
    for (var i = 0; i < keys.length; i++) {
      if (!deepEqualExtended(spec[keys[i]], body[keys[i]])) {
        return false;
      }
    }
    return true;
  }
  return deepEqual(spec, body, { strict: true });
}
