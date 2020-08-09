## Upgrading from Nock 10 to Nock 11

[Release Tag](https://github.com/nock/nock/releases/tag/v11.3.2)

### Bug fixes and internal improvements

Nock 11 includes many under-the-hood improvements, including a fully offline
test suite and 100% test coverage. The codebase was also converted to ES6
syntax and formatted with Prettier. Leaning on the test coverage, some
substantial refactors have begun.

Many bug fixes are included. See the detailed changelog below or the
[compare view][compare] for details.

### Fabulous new features for developers

1. The library ships with TypeScript definitions. (Added in v11.3)
1. Add support for the `http.request` signatures added in Node 10.9
1. Scopes can be filtered using the system environment or any external factor
   using e.g. `.conditionally(() => true)`
1. In-flight modifications to headers are preserved in mock requests.
1. Recorded mocks can be stringified using custom code in the `afterRecord()`
   post-processing hook. When `afterRecord()` returns a string, the
   recorder will no longer attempt to re-stringify it. (Added in v11.3)
1. Reply functions passed to `.reply()` can now be async/promise-returning.
1. Specifying reply headers, either via `.reply()` or `.defaultReplyHeaders()`,
   can now be done consistently using an object, Map, or flat array.

### Breaking changes

For many developers no code changes will be needed. However, there are several
minor changes to the API, and it's possible that you will need to update your
code for Nock to keep working properly. It's unlikely that your tests will
falsely pass; what's more probable is that your tests will fail until the
necessary changes are made.

1. Nock 11 requires Node 8 or later. Nock supports and tests all the "current"
   and "maintenance" versions of Node. As of release, that's Node 8, 10, and 12.

1. In Nock 10, when `reply()` was invoked with a function, the return values were
   handled ambiguously depending on their types.

   Consider the following example:

   ```js
   const scope = nock('http://example.com')
     .get('/')
     .reply(200, () => [500, 'hello world'])
   ```

   In Nock 10, the 200 was ignored, the 500 was interpreted as the status
   code, and the body would contain `'hello world'`. This caused problems
   when the goal was to return a numeric array, so in Nock 11, the 200 is
   properly interpreted as the status code, and `[500, 'hello world']` as the
   body.

   These are the correct calls for Nock 11:

   ```js
   const scope = nock('http://example.com').get('/').reply(500, 'hello world')

   const scope = nock('http://example.com')
     .get('/')
     .reply(500, () => 'hello world')
   ```

   The `.reply()` method can be called with explicit arguments:

   ```js
   .reply() // `statusCode` defaults to `200`.
   .reply(statusCode) // `responseBody` defaults to `''`.
   .reply(statusCode, responseBody) // `headers` defaults to `{}`.
   .reply(statusCode, responseBody, headers)
   ```

   It can be called with a status code and a function that returns an array:

   ```js
   .reply(statusCode, (path, requestBody) => responseBody)
   .reply(statusCode, (path, requestBody) => responseBody, headers)
   ```

   Alternatively the status code can be included in the array:

   ```js
   .reply((path, requestBody) => [statusCode])
   .reply((path, requestBody) => [statusCode, responseBody])
   .reply((path, requestBody) => [statusCode, responseBody, headers])
   .reply((path, requestBody) => [statusCode, responseBody], headers)
   ```

   `.reply()` can also be called with an `async` or promise-returning function. The
   signatures are identical, e.g.

   ```js
   .reply(async (path, requestBody) => [statusCode, responseBody])
   .reply(statusCode, async (path, requestBody) => responseBody)
   ```

   Finally, an error-first callback can be used, e.g.:

   ```js
   .reply((path, requestBody, cb) => cb(undefined, [statusCode, responseBody]))
   .reply(statusCode, (path, requestBody, cb) => cb(undefined, responseBody))
   ```

1. In Nock 10, errors in user-provided reply functions were caught by Nock, and
   generated HTTP responses with status codes of 500. In Nock 11 these errors
   are not caught, and instead are re-emitted through the request, like any
   other error that occurs during request processing.

   Consider the following example:

   ```js
   const scope = nock('http://example.com')
     .post('/echo')
     .reply(201, (uri, requestBody, cb) => {
       fs.readFile('cat-poems.txt', cb) // Error-first callback
     })
   ```

   When `fs.readFile()` errors in Nock 10, a 500 error was emitted. To get the
   same effect in Nock 11, the example would need to be rewritten to:

   ```js
   const scope = nock('http://example.com')
     .post('/echo')
     .reply((uri, requestBody, cb) => {
       fs.readFile('cat-poems.txt', (err, contents) => {
         if (err) {
           cb([500, err.stack])
         } else {
           cb([201, contents])
         }
       })
     })
   ```

1. When `.reply()` is invoked with something other than a whole number status
   code or a function, Nock 11 raises a new error **Invalid ... value for status code**.

1. Callback functions provided to the `.query` method now receive the result of [`querystring.parse`](https://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options) instead of [`qs.parse`](https://github.com/ljharb/qs#parsing-objects).

   In particular, `querystring.parse` does not interpret keys with JSON
   path notation:

   ```js
   querystring.parse('foo[bar]=baz') // { "foo[bar]": 'baz' }
   qs.parse('foo[bar]=baz') // { foo: { bar: 'baz' } }
   ```

1. In Nock 10, duplicate field names provided to the `.query()` method were
   silently ignored. We decided this was probably hiding unintentionally bugs
   and causing frustration with users. In Nock 11, attempts to provide query
   params more than once will throw a new error
   **Query parameters have aleady been defined**. This could happen by calling
   `.query()` twice, or by calling `.query()` after specifying a literal query
   string via the path.

   ```js
   nock('http://example.com')
     .get('/path')
     .query({ foo: 'bar' })
     .query({ baz: 'qux' }) // <-- will throw
     .reply()

   nock('http://example.com')
     .get('/path?foo=bar')
     .query({ baz: 'qux' }) // <-- will throw
     .reply()
   ```

1. Paths in Nock have always required a leading slash. e.g.

   ```js
   const scope = nock('http://example.com').get('/path').reply()
   ```

   In Nock 10, if the leading slash was missing the mock would never match. In
   Nock 11, this raises an error.

1. The `reqheaders` parameter should be provided as a plain object, e.g.
   `nock('http://example.com', { reqheaders: { X-Foo: 'bar' }})`. When the
   headers are specified incorrectly as e.g. `{ reqheaders: 1 }`, Nock 10 would
   behave in unpredictable ways. In Nock 11, a new error
   **Headers must be provided as an object** is thrown.

   ```js
   nock('http://example.com', { reqheaders: 1 }).get('/').reply()
   ```

1. In Nock 10, the `ClientRequest` instance wrapped the native `on` method
   and aliased `once` to it. In Nock 11, this been removed and `request.once`
   will correctly call registered listeners...once.

1. In Nock 10, when the method was not specified in a call to `nock.define()`,
   the method would default to `GET`. In Nock 11, this raises an error.

1. In very old versions of nock, recordings may include a response status
   code encoded as a string in the `reply` field. In Nock 10 these strings could
   be non-numeric. In Nock 11 this raises an error.

### Updates to the mock surface

1. For parity with a real response, a mock request correctly supports all
   the overrides to `request.end()`, including `request.end(cb)` in Node 12.
1. For parity with a real response, errors from the `.destroy()` method
   are propagated correctly. (Added in v11.3)
1. For parity with a real response, the `.complete` property is set when
   ending the response.
1. For parity with a real Socket, the mock Socket has an `unref()` function
   (which does nothing).
