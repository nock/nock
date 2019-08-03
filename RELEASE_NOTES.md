# Release notes

## Upgrading from Nock 10 to Nock 11

1. Nock 11 requires Node 8 or later. Nock supports and tests all the "current"
   and "maintenance" versions of Node. As of now, that's Node 8, 10, and 12.

2. Paths in Nock have always required a leading slash. e.g.

   ```
   const scope = nock('http://example.test')
     .get('/path')
     .reply()
   ```

   In Nock 10, if the leading slash was missing the mock would never match. In
   Nock 11, this raises an error.

3. In Nock 10, when the metthod was not specified in a call to `nock.define()`,
   the method would default `GET`. In Nock 11, this raises an error.

4. Legacy recordings may include the response status code as a string in the
   `reply` field. In Nock 11, an error is raised if the string is not a number.

https://github.com/nock/nock/compare/v10.0.6...beta
got up to may 9
