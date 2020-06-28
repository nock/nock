## Upgrading from Nock 11 to Nock 12

[Release Tag](https://github.com/nock/nock/releases/tag/v12.0.0)

### Breaking changes

1. Support for Node < 10 was dropped.  
   To upgrade Nock, ensure your version of Node is also updated.  
   At the time of release, Node 10.x, 12.x, and 13.x were supported.

1. [`cleanAll()`](https://github.com/nock/nock#cleanall) no longer returns the global `nock` instance ([#1872](https://github.com/nock/nock/pull/1872)).

   ```js
   // before
   nock.cleanAll().restore() // Uncaught TypeError: Cannot read property 'restore' of undefined

   // upgraded
   nock.cleanAll()
   nock.restore()
   ```

1. Support was dropped for the String constructor ([#1873](https://github.com/nock/nock/pull/1873)).  
   Only string primitive are supported. All strings passed to Nock for options should not use `new String` syntax.
   [MDN web docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#String_primitives_and_String_objects).

### New features for developers

1.  [`enableNetConnect()`](https://github.com/nock/nock#enabling-requests) now accepts a function.
    ```js
    nock.enableNetConnect(
      host => host.includes('amazon.com') || host.includes('github.com')
    )
    ```
