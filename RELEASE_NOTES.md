# Release notes

## Upgrading from Nock 10 to Nock 11

1. Nock 11 requires Node 8 or later. Nock supports and tests all the "current"
   and "maintenance" versions of Node. As of now, that's Node 8, 10, and 12.

1. Paths in Nock have always required a leading slash. e.g.

   ```js
   const scope = nock('http://example.com')
     .get('/path')
     .reply()
   ```

   In Nock 10, if the leading slash was missing the mock would never match. In
   Nock 11, this raises an error.

1. In Nock 10, when the method was not specified in a call to `nock.define()`,
   the method would default `GET`. In Nock 11, this raises an error.

1. Legacy recordings may include the response status code as a string in the
   `reply` field. In Nock 11, an error is raised if the string is not a number.

1. The returned value of a reply function is no longer ambiguously handled.
   Returning an array from a reply function with status code, body, and headers
   is only available if `.reply` is provided a callback as a single argument.

   The `.reply` function now has the following signature:

   ```
   .reply([statusCode=200, [bodyOrCallback='', [headers={}]]])
   .reply((path, body) => [statusCode, body='', headers={}])
   ```

   In Nock 10, the following snippet would result in a response with a status
   code of `500` and body of `'hello world'`.  
   In Nock 11, this will result in a response with a status code of `200` and a
   body of `'[500,"hello world"]'`.

   ```js
   nock('http://example.com')
     .get('/')
     .reply(200, () => [500, 'hello world'])
   ```

1. Uncaught errors thrown inside of user provided reply functions, whether
   async or not, will no longer be caught, and will no longer generate a
   successful response with a status code of 500.  
   Instead, the error will be emitted by the request just like any other
   unhandled error during the request processing.  
   Using the following snippet for example, in Nock 10, if `readFile` errors,
   the request will succeed with a response that has a 500 status code.

   ```js
   const scope = nock('http://example.com')
     .post('/echo')
     .reply(201, (uri, requestBody, cb) => {
       fs.readFile('cat-poems.txt', cb) // Error-first callback
     })
   ```

   To achieve the same affect in Nock 11, the code would have to be rewritten to:

   ```js
   const scope = nock('http://example.com')
     .post('/echo')
     .reply((uri, requestBody, cb) => {
       fs.readFile('cat-poems.txt', (err, contents) => {
         if (err) cb([500, err.stack])
         else cb([201, contents])
       })
     })
   ```

1. New Error: `Invalid ... value for status code`.
   If the `.reply` function is provided a first argument, it must be either a
   callback function or a whole number.

1. New Error: `Headers must be provided as an object`
   In Nock 10, the following snippet would "work" in unpredictable ways.
   Now an error is throw with a clear message stating that request headers
   must be provided as a plain object.

   ```js
   nock('http://example.com', { reqheaders: 1 })
     .get('/')
     .reply()
   ```

1. In Nock 10, the `ClientRequest` instance wrapped the native `on` method
   and aliased `once` to it.  
   This been removed and `request.once` once again only call registered
   listeners...once.

1. New Error: `Query parameters have already been already defined`  
   In Nock 10, duplicate field names provided to the `.query` method where
   silently ignored. We decided this was probably hiding unintentionally bugs
   and causing frustration with users. So starting in Nock 11, attempts to
   provide query params more than once will throw an error. This could happen
   by calling `.query` twice, or by calling `.query` after providing literal
   search parameters in via the path.

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

1. Callback functions provided to the `.query` method now receive the result of
   [`querystring.parse`](https://nodejs.org/api/querystring.html#querystring_querystring_parse_str_sep_eq_options)
   instead of [`qs.parse`](https://github.com/ljharb/qs#parsing-objects).
   This will affect users whose query objects include keys that utilize
   JSON path notation.

   ```js
   querystring.parse('foo[bar]=baz') // { "foo[bar]": 'baz' }
   qs.parse('foo[bar]=baz') // { foo: { bar: 'baz' } }
   ```

https://github.com/nock/nock/compare/v10.0.6...next
