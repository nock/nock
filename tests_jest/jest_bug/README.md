# jest + client requests + MSW

There was a bug which caused MSW interceptors not to be applied correctly:

https://github.com/mswjs/interceptors/pull/697

https://github.com/nock/nock/pull/2824

https://github.com/nock/nock/issues/2802

When using jest, each test will get a new instance of the nock module, if the bug is present the second test will fail to intercept a client request with this error:

> NetConnectNotAllowedError: Nock: Disallowed net connect for "example.com:80/foo"
