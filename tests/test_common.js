'use strict';

const tap = require('tap');
const { test, given } = require('sazerac');
const common = require('../lib/common');
const matchBody = require('../lib/match_body');

tap.test('matchBody ignores new line characters from strings', t => {
  t.true(
    matchBody(
      "something //here is something more \n",
      "something //here is something more \n\r"));
  t.end();
});

tap.test("when spec is a function, it's called with newline characters intact", t => {
  const exampleBody = "something //here is something more \n";
  let param
  matchBody(body => { param = body }, exampleBody);
  t.equal(param, exampleBody);
  t.end()
});

tap.test('matchBody should not throw, when headers come node-fetch style as array', t => {
  t.false(
    matchBody.call(
      {headers: {'Content-Type': ["multipart/form-data;"]}},
      {},
      "test"
    ));
  t.end()
});

tap.test("matchBody should not ignore new line characters from strings when Content-Type contains 'multipart'", t => {
  t.true(
    matchBody.call(
      {headers: {'Content-Type': "multipart/form-data;"}},
      "something //here is something more \nHello",
      "something //here is something more \nHello"
    ));
  t.end()
});

tap.test("matchBody should not ignore new line characters from strings when Content-Type contains 'multipart' (arrays come node-fetch style as array)", t => {
  t.true(
    matchBody.call(
      {headers: {'Content-Type': ["multipart/form-data;"]}},
      "something //here is something more \nHello",
      "something //here is something more \nHello"
    ));
  t.end()
});

tap.test('matchBody uses strict equality for deep comparisons', t => {
  t.false(
    matchBody(
      { number: 1 },
      '{"number": "1"}'
    ));
  t.end()
});

tap.test('isBinaryBuffer works', t => {
  //  Returns false for non-buffers.
  t.false(common.isBinaryBuffer());
  t.false(common.isBinaryBuffer(''));

  //  Returns true for binary buffers.
  t.true(common.isBinaryBuffer(Buffer.from('8001', 'hex')));

  //  Returns false for buffers containing strings.
  t.false(common.isBinaryBuffer(Buffer.from('8001', 'utf8')));

  t.end();
});

tap.test('headersFieldNamesToLowerCase works', t => {
  t.deepEqual(
    common.headersFieldNamesToLowerCase({
      HoSt: 'example.com',
      'Content-typE': 'plain/text'
    }),
    {
      host: 'example.com',
      'content-type': 'plain/text'
    });
  t.end();
});

tap.test('headersFieldNamesToLowerCase throws on conflicting keys', t => {
  t.throws(
    () => common.headersFieldNamesToLowerCase({
      'HoSt': 'example.com',
      'HOST': 'example.com'
    }),
    {message: 'Failed to convert header keys to lower case due to field name conflict: host'}
  );
  t.end();
});

tap.test('headersFieldsArrayToLowerCase works on arrays', function (t) {
  t.deepEqual(
    // Sort for comparison beause order doesn't matter.
    common.headersFieldsArrayToLowerCase(['HoSt', 'Content-typE']).sort(),
    ['content-type', 'host']
    );
  t.end();
});

tap.test('headersFieldsArrayToLowerCase deduplicates arrays', function (t) {
  t.deepEqual(
    // Sort for comparison beause order doesn't matter.
    common.headersFieldsArrayToLowerCase(['hosT', 'HoSt', 'Content-typE', 'conTenT-tYpe']).sort(),
    ['content-type', 'host']
    );
  t.end();
});

tap.test('deleteHeadersField deletes fields with case-insensitive field names', t => {
  // Prepare.
  const headers = {
    HoSt: 'example.com',
    'Content-typE': 'plain/text'
  };

  // Confidence check.
  t.true(headers.HoSt);
  t.true(headers['Content-typE']);

  // Act.
  common.deleteHeadersField(headers, 'HOST');
  common.deleteHeadersField(headers, 'CONTENT-TYPE');

  // Assert.
  t.false(headers.HoSt);
  t.false(headers['Content-typE']);

  // Wrap up.
  t.end();
});

tap.test('matchStringOrRegexp', function (t) {
  t.true(common.matchStringOrRegexp('to match', 'to match'), 'true if pattern is string and target matches');
  t.false(common.matchStringOrRegexp('to match', 'not to match'), "false if pattern is string and target doesn't match");

  t.true(common.matchStringOrRegexp(123, 123), 'true if pattern is number and target matches');

  t.false(common.matchStringOrRegexp(undefined, 'to not match'), 'handle undefined target when pattern is string');
  t.false(common.matchStringOrRegexp(undefined, /not/), 'handle undefined target when pattern is regex');

  t.ok(common.matchStringOrRegexp('to match', /match/), 'match if pattern is regex and target matches');
  t.false(common.matchStringOrRegexp('to match', /not/), "false if pattern is regex and target doesn't match");
  t.end();
});

tap.test('stringifyRequest', function (t) {
  const exampleOptions = {
    method: "POST",
    port: 81,
    proto: 'http',
    hostname: 'www.example.com',
    path: '/path/1',
    headers: {cookie: 'fiz=baz'}
  };

  t.deepEqual(
    JSON.parse(common.stringifyRequest(exampleOptions, {foo: 'bar'})),
    {
      "method":"POST",
      "url":"http://www.example.com:81/path/1",
      "headers":{
        "cookie": "fiz=baz"
      },
      "body": {
        "foo": "bar"
      }
    }
  );

  t.deepEqual(
    JSON.parse(common.stringifyRequest(
      {
        ...exampleOptions,
        method: 'GET',
      },
      null)),
    {
      "method":"GET",
      "url":"http://www.example.com:81/path/1",
      "headers":{
        "cookie": "fiz=baz"
      }
    }
  );

  t.end();
});


tap.test('headersArrayToObject', function (t) {
  const headers = [
    "Content-Type",
    "application/json; charset=utf-8",
    "Last-Modified",
    "foobar",
    "Expires",
    "fizbuzz"
  ];

  t.deepEqual(common.headersArrayToObject(headers), {
    "content-type": "application/json; charset=utf-8",
    "last-modified": "foobar",
    "expires": "fizbuzz"
  });

  const headersMultipleSetCookies = headers.concat([
    "Set-Cookie",
    "foo=bar; Domain=.github.com; Path=/",
    "Set-Cookie",
    "fiz=baz; Domain=.github.com; Path=/",
    "set-cookie",
    "foo=baz; Domain=.github.com; Path=/"
  ]);

  t.deepEqual(common.headersArrayToObject(headersMultipleSetCookies), {
    "content-type": "application/json; charset=utf-8",
    "last-modified": "foobar",
    "expires": "fizbuzz",
    "set-cookie": [
      "foo=bar; Domain=.github.com; Path=/",
      "fiz=baz; Domain=.github.com; Path=/",
      "foo=baz; Domain=.github.com; Path=/"
    ]
  });

  t.end();
});
