## The problem

Nock's lifecycle methods are confusingly named and at times inconvenient. It
takes a lot of studying to figure out the natural thing. It's easy to
misunderstand this and leave unwanted state in `nock`.

Nock doesn't automatically have a way to assert that mocks have been
satisfied; it's the caller's responsibility to do this for each one.

See
https://github.com/paulmelnikow/icedfrisby-nock/blob/master/icedfrisby-nock.js
for one attempt I made at getting the lifecycle right.

## Typical use cases

1. Assert that all mocks have been satisfied.
2. Completely reset `nock` after a test.
3. Allowing unmocked requests only to certain hosts.
4. Preventing unmocked requests entirely.
5. Simulating network connection failures.
6. Temporarily disabling http call interception while preserving registered mocks.
7. Turn `nock` all the way off and clean up its state (\*\* I've actually never
   wanted to do this, but wanted to include it in the analysis)

## Analysis

| Use case                                                                | Code                                                                        | Assessment                                                                                                                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assert that all mocks have been satisfied                               | `scopes.forEach(scope => scope.done())`                                     | `done()` could have a more explicit name, though otherwise this is fairly clear. However it requires the caller to keep track of all the scopes, which is not ideal. |
| Reset `nock` after a test to its initial post-`require()` state         | `nock.restore(); nock.cleanAll(); nock.enableNetConnect(); nock.activate()` | This is too much typing.                                                                                                                                             |
| Forbid unmocked requests                                                | `nock.disableNetConnect()`                                                  | This _looks_ okay, but it doesn't have the desired effect. Errors are received by the client code and often swallowed up by the application (#884).                  |
| Allow unmocked requests, but only to certain hosts                      | `nock.disableNetConnect(); nock.enableNetConnect('example.com')`            | This is a common use case, and should be possible to do more succintly, with a single call.                                                                          |
| Simulate network connection failure                                     | N/A                                                                         | This is what `disableNetConnect()` does today. However from the function name, it's not really clear this is the intention.                                          |
| Temporarily disable http interception while preserving registered mocks | `nock.restore()`                                                            | This is a confusing name, as it only cleans _part_ of nock's state.                                                                                                  |
| Turn `nock` all the way off and clean up its state                      | `nock.restore(); nock.cleanAll()`                                           | `restore()` is a confusing name. This isn't the most common use case, so it is probably okay that it requires two function calls.                                    |

The code for these use cases should be further reviewed and validated. I'm not
completely sure it's correct.

## Proposed solutions

Create functions that correspond to these use cases, and give them unambiguous names.

### Use case 1: Resetting

#### Use case

Reset `nock` after a test to its initial post-`require()` state.

#### Proposed solution

Add `nock.reset()`.

This calls:

```js
nock.restore()
nock.cleanAll()
nock.enableNetConnect()
nock.activate()
```

#### Discussion

`nock.reset()` is suitable for running from `afterEach()` or `finally()` to
prepare for the next test.

### Use case 2: Temporary deactivation

#### Use case

Temporarily disable http interception while preserving registered mocks.

#### Proposed solution

1. Rename `nock.restore()` to `nock.deactivate()`.
2. Emit a deprecation warning for `nock.restore()`.

#### Discussion

The new name harmonizes with `nock.activate()` which is being kept: these methods are
inverses of each other.

### Use case 3: Assertions

#### Use case

Assert that all mocks have been satisfied.

#### Proposed solution

1. Add `nock.assertAllMocksUsed()`.
2. Rename `scope.done()` to `scope.assertMocksUsed()`.
3. Emit a deprecation warning for `scope.done()`.

#### Discussion

`nock.assertAllMocksUsed()` does the equivalent of `scopes.forEach(scope => scope.done())`.

`scope.assertMocksUsed()` is a better name for a function that makes an
assertion. It harmonizes better with `assertAllMocksUsed()`. Even though it's
a method on a scope, it's `assertMocksUsed()`, not `assertMockUsed()`. This
avoids the possibility of confusion in a case like
`nock.get().times(5).reply()`, where a single scope is responsible for 5 mock
requests. We need to keep this function around because it allows for granular
control within a complex text with many scopes.

`nock.assertAllMocksUsed()` is suitable to call directly from a test.

Some developers may prefer to call it from an `afterEach()` hook to avoid
boilerplate. Since not all tests in a suite may use a mock, it should do the
natural thing when no mocks have been created, which is no-op.

### Use case 4: Handling unmocked requests (proposal 1)

#### Use cases

- Simulate network connection failure
- Forbid unmocked requests (Closes #844)

#### Proposed solution

1. Rename `nock.disableNetConnect()` to `nock.simulateUnreachability()`.
2. Optionally pass an argument `nock.simulateUnreachability({ allowedHosts })`
   to specify exceptions, i.e. hosts which should still be reachable.
3. Add `nock.forbidUnmockedRequests()` which causes any unmocked request
   to be considered a programmer error.
4. When Nock blocks requests to mocked hostnames, throw the error instead.
5. Emit a deprecation warning from `nock.disableNetConnect()`.
6. Emit a deprecation warning when `nock.enableNetConnect()` is invoked with an
   argument.

#### Discussion

`nock.simulateUnreachability()` emits an unreachable-like error through normal
HTTP error channels.

In contrast, `nock.forbidUnmockedRequests()` throws an assertion error – as if
it's a type error. The error is not emitted through the HTTP client. That way
it bubbles up to the test runner instead of being handled by the client
library and application.

`nock.simulateUnreachability({ allowedHosts: ['localhost'] })` replaces
`nock.enableNetConnect('localhost')`, while clarifying that the call causes
some requests to be blocked.

Okay, so I'm not thrilled with these proposals. While these use cases are
important and need to be distinguished, having similar behavior triggered by
two different functions is confusing. Let me try to propose an alternative
with a combined API.

### Use case 4: Handling unmocked requests (proposal 2)

#### Use cases

- Simulate network connection failure
- Forbid unmocked requests (Closes #844)

#### Proposed solution

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
      an unreachable-like error through normal HTTP error channels.
   3. An unmocked request hitting a host matching `fail` is considered a
      programmer error. Either the test or the application has done something
      wrong. The error is thrown – as if a TypeError – so it bubbles up to
      the test runner.

#### Discussion

As `simulateUnreachable` generates an error which can be handled by the client
library and application code, this option is suitable for _testing how an
application handles unreachable hosts_.

By putting a wildcard match in the `fail` list, you know your tests will
immediately choke if they try to hit live servers. Since the client library
and application are kept out of the loop, this _provides confidence that a
mock is configured for every request made by the application and tests_.
