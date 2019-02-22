# The problem

Nock's lifecycle methods are confusingly named and at times inconvenient. It
takes a lot of studying to figure out the natural thing. It's easy to
misunderstand this and leave unwanted state in `nock`.

Nock doesn't automatically have a way to assert that mocks have been
satisfied; it's the caller's responsibility to do this for each one.

See
https://github.com/paulmelnikow/icedfrisby-nock/blob/master/icedfrisby-nock.js
for one attempt I made at getting the lifecycle right.

# Typical use cases

1. Assert that all mocks have been satisfied.
2. Completely reset `nock` after a test.
3. Allowing unmocked requests only to certain hosts.
4. Preventing unmocked requests entirely.
5. Simulating network connection failures.
6. Temporarily disabling http call interception while preserving registered mocks.

# Analysis

| Use case                                                                | Code                                                                        | Assessment                                                                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Assert that all mocks have been satisfied                               | `scopes.forEach(scope => scope.done())`                                     | Meh. This requires keeping track of all the scopes.                                                                            |
| Completely reset `nock` after a test                                    | `nock.restore(); nock.cleanAll(); nock.enableNetConnect(); nock.activate()` | Meh. Too much typing.                                                                                                          |
| Forbid unmocked requests                                                | `nock.disableNetConnect()`                                                  | Meh. Errors are swallowed up (#884). Also, if `restore()` has been called does `disableNetConnect()` automatically reactivate? |
| Allow unmocked requests, but only to certain hosts                      | `nock.disableNetConnect(); nock.enableNetConnect('example.com')`            | Should this require two calls?                                                                                                 |
| Simulate network connection failure                                     | N/A                                                                         | Meh. This is possible with `disableNetConnect()` however it's muddied up between this and "Forbid unmocked requests" (#884).   |
| Temporarily disable http interception while preserving registered mocks | `nock.restore()`                                                            | This is a confusing name, as it only cleans _part_ of nock's state.                                                            |

The code for these use cases should be further reviewed and validated. I'm not
completely sure it's correct.

# Proposed solution

Create functions that correspond to these use cases, and give them unambiguous names.

1. Add `nock.reset()` which resets 100% of nock's state. I think that is the
   equivalent of `nock.restore(); nock.cleanAll(); nock.enableNetConnect()`.
   This is suitable for running from `afterEach()` or `finally`.
2. Rename `nock.restore()` to `nock.deactivate()`. `nock.restore()` should
   still work but emit a deprecation warning to encourage switching to
   `nock.reset()`. The new name harmonizes with `nock.activate()` as they are
   inverses of each other.
3. Leave `nock.cleanAll()` as is.
4. Add `nock.assertAll()` which does the equivalent of
   `scopes.forEach(scope => scope.done())`. This probably should be invoked
   in the test itself.
5. Rename `scope.done()` to `scope.assert()` to harmonize with `assertAll()`
   and make it clearer what the function is for. Emit a deprecation warning for
   `scope.done()`. Encourage switching to `nock.assertAll()`, or `nock.assert()`
   if more granular control is needed.
6. Add `nock.simulateUnreachable()` or similar, which works like the current
   `disableNetConnect()`, emitting an unreachable-like error through the usual
   channels.
7. Add `nock.lockdown()` (or `nock.forbidUnmockedRequests()`?) which causes
   any unmocked request to immediately raise an assertion error. The error should
   not emit through the request. That's because we want it to be handled by the
   test runner, not caught by the application. This resolves #884. Add options
   for allowing / denying certain hosts so this can replace `disableNetConnect()`
   and `enableNetConnect()`. Emit a warning from those functions, encouraging
   switching to either `nock.lockdown()` or `nock.simulateUnreachable()`
   depending on the motive of the test.
