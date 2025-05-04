# Changelog

Nock’s changelog can be found directly in the [GitHub release notes](https://github.com/nock/nock/releases).  
These are automatically created by [semantic-release](https://github.com/semantic-release/semantic-release) based on their [commit message conventions](https://semantic-release.gitbook.io/semantic-release#commit-message-format).

Migration guides are available for major versions in the [migration guides directory](https://github.com/nock/nock/tree/main/migration_guides).

This release aim to modernize and refresh `nock`, remove long-supported hacks and create more expected library.

Breaking changes:

5. header (matcher?) value function
6. body matcher function

Ideas:
2. recorder `reqheaders` should be empty object and not undefined, also need to rename the object keys (e.g. `body` vs `response` is confusing)
3. what's the point for response in default header function (req, res, body)
4. Why do we strip the brackets in ipv6?
5. Add a reason for `no match` event
6. Make request/replied event in the playback_interceptor async and await for them.

TODO:

1. fix the rawHeaders symbol in `msw/interceptors` (in `FetchResponse`) (generateRequestAndResponseObject, generateRequestAndResponse)
2. // TODO: request.headers.forEach skip a header, need to investigate it.
3. remove old lint rules and set `node:` rule:q
   5: test: receives the correct arguments
5. test: should delay the clock between the `response` event and the first `data` event
6. test: should abort a request with a timeout signal
7. Think about a better name for `getDecompressedGetBody`
