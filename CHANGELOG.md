# Changelog

Nock’s changelog can be found directly in the [GitHub release notes](https://github.com/nock/nock/releases).  
These are automatically created by [semantic-release](https://github.com/semantic-release/semantic-release) based on their [commit message conventions](https://semantic-release.gitbook.io/semantic-release#commit-message-format).

Migration guides are available for major versions in the [migration guides directory](https://github.com/nock/nock/tree/main/migration_guides).

// TODO: Remove this before merge:

# Breaking changes:

1. No longer support preemptive timeout for delay connection. Please use fake timers instead.

We increased our compatibility with Node.js:

1. Request (http.get/request) interception resolution is no longer sync.
2. socket.authorized now returns false. This is the case most of the time.
3. headers matcher gets non-string values.
4. socket ref/unref return this.
5. response rawHeaders no longer return arrays.
6. We no longer support undefined content-length
7. GET requests no longer may have body.
8. 204, 205, 304 responses can not have body.

# Topics to discuss

1. In this PR I tried (very poorly :sweat_smile:) to keep the changes to minimum. My next step is to remove all parts that we no longer need, as now the interception logic sits in mswjs/interceptors.
1. test: does not record requests from previous sessions
1. test: get correct filtering with scope and request headers filtering - why is this considered as correct behavior?
1. test: should be safe to call in the middle of a request
   We can (should?) send cleanAll to next loop with setImmediate
1. test: socket emits connect and secureConnect - edge case (https://github.com/mswjs/interceptors/pull/515#issuecomment-2067702330)
1. test: error events on reply streams proxy to the response - what's the use case for this?

# Need to be done

1. Support fetch decompress (https://github.com/mswjs/interceptors/pull/604)
2. test: Request with `Expect: 100-continue` triggers continue event (https://github.com/mswjs/interceptors/pull/599)
3. test: socket has getPeerCertificate() method which returns a random base64 string

For me:
Why tests stuck if expect fails in req callback?
