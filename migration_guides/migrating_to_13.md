## Upgrading from Nock 12 to Nock 13

[Release Tag](https://github.com/nock/nock/releases/tag/v13.0.0)

### Breaking changes

1. `Scope.log` has been removed. Use the `debug` library when [debugging](https://github.com/nock/nock#debugging) failed matches.

1. `socketDelay` has been removed. Use [`delayConnection`](https://github.com/nock/nock#delay-the-connection) instead.

1. `delay`, `delayConnection`, and `delayBody` are now setters instead of additive.

   ```js
   nock('http://example.com')
     .get('/')
     .delay(1)
     .delay({ head: 2, body: 3 })
     .delayConnection(4)
     .delayBody(5)
     .delayBody(6)
     .reply()
   ```

   Previously, the connection would have been delayed by 7 and the body delayed by 14.
   Now, the connection will be delayed by 4 and the body delayed by 6.

1. [When recording](https://github.com/nock/nock#recording), skipping body matching using `*` is no longer supported by `nock.define`.
   Set the definition body to `undefined` instead.

   ```js
   nock.define([
     {
       scope: 'http://example.test',
       method: 'POST',
       path: '/',
       body: '*', // remove this line or set to undefined
       response: 'matched',
     },
   ])
   ```

1. `ClientRequest.abort()` has been updated to align with Node's native behavior.

   - Nock use to always emit a 'socket hang up' error. Now it only emits the error if `abort` is called between the 'socket' and 'response' events.
   - The emitted 'abort' event now happens on `nextTick`.
   - The socket is now only destroyed if the 'socket' event has fired, and now emits a 'close' event on `nextTick` that propagates though the request object.
   - `request.aborted` attribute is set to `true` instead of a timestamp. [Changed in Node v11.0](https://github.com/nodejs/node/pull/20230).
   - Calling `write`, `end`, or `flushHeaders` on an aborted request no longer emits an error.
     However, writing to a request that is already finished (ended) will emit a 'write after end' error.

1. Playback of a mocked responses will now never happen until the 'socket' event is emitted.
   The 'socket' event is still artificially set to emit on `nextTick` when a ClientRequest is created.  
   This means in the following code the Scope will never be done because at least one tick needs
   to happen before any matched Interceptor is considered consumed.
   ```js
   const scope = nock(...).get('/').reply()
   const req = http.get(...)
   scope.done()
   ```
   The correct way to verify such an action is to call [`scope.done`](https://github.com/nock/nock#expectations) after waiting for a 'response', 'timeout', or 'socket' event on the request.  
   For example:
   ```js
   const scope = nock(...).get('/').reply()
   const req = http.get(...)
   req.on('response', () => {
     scope.done()
   })
   ```
