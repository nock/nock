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
    1. Add `nock.reset()` which calls
       `nock.restore(); nock.cleanAll(); nock.enableNetConnect(); nock.activate()`.
       This is suitable for running from `afterEach()` or `finally`.
2.  **Temporarily disable http interception while preserving registered mocks**
    1. Rename `nock.restore()` to `nock.deactivate()`. The new name
       harmonizes with `nock.activate()`: they are inverses of each other.
    2. Emit a deprecation warning for `nock.restore()`.
3.  **Assert that all mocks have been satisfied**
    1. Add `nock.assertAll()` which does the equivalent of
       `scopes.forEach(scope => scope.done())`. This is suitable to call from
       the test itself, though some developers may prefer to call it from an
       `afterEach()` hook to avoid boilerplate. Accordingly when no mocks
       have been set up, it should do the natural thing: no-op.
    2. Rename `scope.done()` to `scope.assert()`. This is a better nam
       because it makes it clear it makes an assertion, and it harmonizes
       better with `assertAll()`. Keep the function around because it
       allows for granular control.
    3. Emit a deprecation warning for `scope.done()`.
4.  **Simulate network connection failure**:
    1. Rename `disableNetConnect()` to `nock.simulateUnreachability()`. As before,
       emit an unreachable-like error through normal HTTP error channels.
    2. Optionally pass an argument `{ allowedHosts }` to specify exceptions: hosts
       which should still be reachable. This replaces calls like
       `enableNetConnect('localhost')`, while clarifying that the call causes some
       requests to be blocked.
    3. Emit a deprecation warning from `disableNetConnect()`.
    4. Emit a deprecation warning when `enableNetConnect()` is invoked with an
       argument. These calls should be changed to
       `simulateUnreachability({ allowedHosts: ... })`.
5.  **Forbid unmocked requests**:
    1. Add `nock.forbidUnmockedRequests()` which causes any unmocked request
       to be considered a programmer error. In contrast to
       `simulateUnreachable()`, the error is thrown – as if a TypeError – rather
       than emitted through the HTTP client. That way it bubbles up to the test
       runner instead of being handled by the client library and application.
    2. When Nock blocks requests to mocked hostnames, throw the error instead.
    3. This resolves #844.
6.  I'm not thrilled with these proposals for `nock.simulateUnreachability()` and
    `nock.forbidUnmockedRequests()`. While these use cases are important and need
    to be distinguished, having similar behavior triggered by two different
    functions is confusing. Let me try to propose an **alternative** with a
    combined API.
    1. Add a new function that controls nock's behavior on unmocked requests:
       `nock.whenUnmocked({ callThrough, simulateUnreachable, fail })`.
    2. Each of `callThrough`, `simulateUnreachable`, and `fail` is an optional
       array. The array can be a mix of literal strings, the wildcard string, and
       regexes.
    3. Calling `nock.whenUnmocked()` with no parameters is equivalent to
       `nock.whenUnmocked({ callThrough: '*' })`. This is also nock's initial state.
    4. The order of precedence is: `callThrough`, `simulateUnreachable`, `fail`.
       1. An unmocked request hitting a host matching `callThrough` is let through.
       2. An unmocked request hitting a host matching `simulateUnreachable` emits
          an unreachable-like error through normal HTTP error channels. As the
          error can be handled by the client library and application code, this option is
          suitable for _testing how an application handles unreachable hosts_.
       3. An unmocked request hitting a host matching `fail` is considered a
          programmer error. Either the test or the application has done something
          wrong. The error is thrown – as if a TypeError – so it bubbles up to
          the test runner. By putting a wildcard match in this list, you know
          your tests will immediately choke if they try to hit live servers.
          Since the client library and application are kept out of the loop, this
          _provides confidence that a mock is configured for each request made by
          the application_.
