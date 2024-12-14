# Changelog

Nock’s changelog can be found directly in the [GitHub release notes](https://github.com/nock/nock/releases).  
These are automatically created by [semantic-release](https://github.com/semantic-release/semantic-release) based on their [commit message conventions](https://semantic-release.gitbook.io/semantic-release#commit-message-format).

Migration guides are available for major versions in the [migration guides directory](https://github.com/nock/nock/tree/main/migration_guides).

This release aim to modernize and refresh `nock`, remove long-supported hacks and create more expected library.

Breaking changes:
1. `no match` event send Request object. before it had two different signatures.
2. ClientRequest -> Request
  1. All interceptor events: 'request', 'replied'
  2. `replyFunction` now get a request, `interceptor` no longer contains `req` property.
  3. header (matcher?) value function
  4. body matcher function
3. remove `delayBody` & `delayConnection` functions, `delay` function get only one argument.
4. `this.req` no longer available, use `request` argument instead.
5. What's the point of `filteringPath` function?:q
<!-- 6. return `host` response header as node does. -->


Ideas:
1. Consolidate `reply` arguments (replyFunction vs fullReplyFunction, stream, and more)
2. recorder `reqheaders` should be empty  object and not undefined, also need to rename the object keys (e.g. `body` vs `response` is confusing)
3. what's the point for response in default header function (req, res, body)
4. Why do we strip the brackets in ipv6?


TODO:
1. fix the rawHeaders symbol in `msw/interceptors` (in `FetchResponse`)  (generateRequestAndResponseObject, generateRequestAndResponse)
2. // TODO: request.headers.forEach skip a header, need to investigate it.
3. remove old lint rules and set `node:` rule:q
4. test: Host header is ignored during matching if not defined on the request
5: test: receives the correct arguments
6. test: should delay the clock between the `response` event and the first `data` event
7. test: should abort a request with a timeout signal