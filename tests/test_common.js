
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
