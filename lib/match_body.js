var deepEqual = require('assert').deepEqual;
var qs = require('querystring');

module.exports =
function matchBody(spec, body) {
  if (typeof spec == 'undefined') return true;
  var options = this || {};

  if (Buffer.isBuffer(body)) {
    body = body.toString();
  }

  var json;
  try {
    json = JSON.parse(body);
  } catch(err) {
    // do nothing
  }
  if (typeof json !== 'undefined') body = json;
  else {
    if (
      (typeof spec == 'object') &&
      options.headers &&
      options.headers['content-type'] &&
      options.headers['content-type'].match(/application\/x-www-form-urlencoded/)) {
        body = qs.parse(body);
      }
      
  }

  if (typeof spec == 'string') {
    return body.toString() === spec;
  }

  try {
    deepEqual(spec, body);
    return true;
  } catch(err) {
    return false;
  }

};