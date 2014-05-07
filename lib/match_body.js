var deepEqual = require('assert').deepEqual;
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

  // try to transform body to json
  var json;
  if (typeof spec === 'object') {
    try { json = JSON.parse(body);} catch(err) {}
    if (json !== undefined) {
      body = json;
    }
    else
      if (
        (typeof spec === 'object') &&
        options.headers
      )
      {
        var contentType = options.headers['Content-Type']
                            || options.headers['content-type'];

        if (contentType.match(/application\/x-www-form-urlencoded/)) {
          body = qs.parse(body);
        }
      }
  }

  try {
    deepEqual(spec, body);
    return true;
  } catch(err) {
    return false;
  }

};
