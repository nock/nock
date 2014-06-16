
var common  = require('../lib/common')
  , tap     = require('tap');

tap.test('isBinaryBuffer works', function(t) {

  //  Returns false for non-buffers.
  t.false(common.isBinaryBuffer());
  t.false(common.isBinaryBuffer(''));

  //  Returns true for binary buffers.
  t.true(common.isBinaryBuffer(new Buffer('8001', 'hex')));

  //  Returns false for buffers containing strings.
  t.false(common.isBinaryBuffer(new Buffer('8001', 'utf8')));

  t.end();

});

tap.test('headersFieldNamesToLowerCase works', function(t) {

  var headers = {
    'HoSt': 'example.com',
    'Content-typE': 'plain/text'
  };

  var lowerCaseHeaders = common.headersFieldNamesToLowerCase(headers);

  t.equal(headers.HoSt, lowerCaseHeaders.host);
  t.equal(headers['Content-typE'], lowerCaseHeaders['content-type']);
  t.end();

});

tap.test('headersFieldNamesToLowerCase throws on conflicting keys', function(t) {

  var headers = {
    'HoSt': 'example.com',
    'HOST': 'example.com'
  };

  try {
    common.headersFieldNamesToLowerCase(headers);
  } catch(e) {
    t.equal(e.toString(), 'Error: Failed to convert header keys to lower case due to key conflict: host');
    t.end();
  }

});

