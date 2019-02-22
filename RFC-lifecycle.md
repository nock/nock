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
7. Turn `nock` all the way off and clean up its state (\*\* I've actually never
   wanted to do this, but wanted to include it in the analysis)

# Analysis

| Use case                                                                | Code                                                                        | Assessment                                                                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Assert that all mocks have been satisfied                               | `scopes.forEach(scope => scope.done())`                                     | Meh. This requires keeping track of all the scopes.                                                                            |
| Reset `nock` after a test to its initial post-`require()` state         | `nock.restore(); nock.cleanAll(); nock.enableNetConnect(); nock.activate()` | Meh. Too much typing.                                                                                                          |
| Forbid unmocked requests                                                | `nock.disableNetConnect()`                                                  | Meh. Errors are swallowed up (#884). Also, if `restore()` has been called does `disableNetConnect()` automatically reactivate? |
| Allow unmocked requests, but only to certain hosts                      | `nock.disableNetConnect(); nock.enableNetConnect('example.com')`            | Should this require two calls?                                                                                                 |
| Simulate network connection failure                                     | N/A                                                                         | Meh. This is possible with `disableNetConnect()` however it's muddied up between this and "Forbid unmocked requests" (#884).   |
| Temporarily disable http interception while preserving registered mocks | `nock.restore()`                                                            | This is a confusing name, as it only cleans _part_ of nock's state.                                                            |
| Turn `nock` all the way off and clean up its state                      | `nock.restore(); nock.cleanAll()`                                           | This is a confusing name, as it only cleans _part_ of nock's state.                                                            |

The code for these use cases should be further reviewed and validated. I'm not
completely sure it's correct.

# Proposed solution

Create functions that correspond to these use cases, and give them unambiguous names.

1.  **Reset `nock` after a test to its initial post-`require()` state**
    i. Add `nock.reset()` which calls
    `nock.restore(); nock.cleanAll(); nock.enableNetConnect(); nock.activate()`.
    This is suitable for running from `afterEach()` or `finally`.
2.  **Temporarily disable http interception while preserving registered mocks**
    i. Rename `nock.restore()` to `nock.deactivate()`. The new name
    harmonizes with `nock.activate()`: they are inverses of each other.
    iii. Emit a deprecation warning for `nock.restore()`.
3.  Leave `nock.cleanAll()` as is.
4.  **Assert that all mocks have been satisfied**
    i. Add `nock.assertAll()` which does the equivalent of
    `scopes.forEach(scope => scope.done())`. This is suitable to call from
    the test itself, though some developers may prefer to call it from an
    `afterEach()` hook to avoid boilerplate. Accordingly when no mocks
    have been set up, it should do the natural thing: no-op.
    ii. Rename `scope.done()` to `scope.assert()`. This is a better nam
    because it makes it clear it makes an assertion, and it harmonizes
    better with `assertAll()`. Keep the function around because it
    allows for granular control.
    iii. Emit a deprecation warning for `scope.done()`.
5.  **Simulate network connection failure**:
    i. Rename `disableNetConnect()` to `nock.simulateUnreachable()`. As before,
    this method emits an unreachable-like error through normal HTTP error
    channels.
    ii. Add a deprecation warning for `disableNetConnect()`.
6.  **Forbid unmocked requests**:
    i. Add `nock.forbidUnmockedRequests()` which causes any unmocked request
    to be considered a programmer error. In contrast to
    `simulateUnreachable()`, the error is thrown – as if a `TypeError` – rather
    than emitted through the HTTP client. That way instead of being received by
    the client library and ultimately the application, it bubbles up to the test
    runner.
    ii. This resolves #844.
    iii. Add a deprecation warning for `enableNetConnect()`.

    test runner, not caught by the application. This resolves #884. Add options
    for allowing / denying certain hosts so this can replace `disableNetConnect()`
    and `enableNetConnect()`. Emit a warning from those functions, encouraging
    switching to either `nock.forbidUnmockedRequests()` or `nock.simulateUnreachable()`
    depending on the motive of the test.
