# Changelog

Nock’s changelog can be found directly in the [GitHub release notes](https://github.com/nock/nock/releases).  
These are automatically created by [semantic-release](https://github.com/semantic-release/semantic-release) based on their [commit message conventions](https://semantic-release.gitbook.io/semantic-release#commit-message-format).

Migration guides are available for major versions in the [migration guides directory](https://github.com/nock/nock/tree/main/migration_guides).

Remove this before merge:
Breaking changes:
1. recorder.play and nockDone are async
3. Small - Fix headers matcher gets non-string values (this test: `should match headers with function: gets the expected argument`)
2. Fix - socket ref/unref return this


Topics to discuss:
2. GET requests no longer may have body. we can discuss this with msw/interceptors maintainer.
3. 204, 205, 304 responses can not have body.
4. Are we OK that we emit "internal-response" to the end user as well?
5. Test timeout without actually wait
6. should denote the response client is authorized for HTTPS requests
7. res.req is unofficial, why do we have test for it? "has a req property on the response". why they can't jut use req that returns from the http.get/request
8. getPeerCertificate does not return string: https://nodejs.org/api/tls.html#tlssocketgetpeercertificatedetailed
   test: "socket has getPeerCertificate() method which returns a random base64 string"
9. why the behavior is different than Node's? test: "Request with `Expect: 100-continue` triggers continue event"
10. Do we need to call the original request on passthrough? 
    test: "when http.get and http.request have been overridden before nock overrides them, http.get calls through to the expected method"
11. why?
    test: "mocking a request which sends an empty buffer should finalize"

For me:
Why tests stuck if expect fails in req callback?