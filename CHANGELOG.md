# Changelog

Nock’s changelog can be found directly in the [GitHub release notes](https://github.com/nock/nock/releases).  
These are automatically created by [semantic-release](https://github.com/semantic-release/semantic-release) based on their [commit message conventions](https://semantic-release.gitbook.io/semantic-release#commit-message-format).

Migration guides are available for major versions in the [migration guides directory](https://github.com/nock/nock/tree/main/migration_guides).

// TODO: Remove this before merge:

# Breaking changes:
We increased our compatibility with Node.js:

1. Fix headers matcher gets non-string values
2. Fix - socket ref/unref return this
3. We no longer support undefined content-length
1. GET requests no longer may have body. 
3. 204, 205, 304 responses can not have body.

# Topics to discuss
1. Test timeout without actually wait
2. does not record requests from previous sessions
3. In this PR I tried (very poorly :sweat_smile:) to keep the changes to minimum. My next step is to remove all parts that we no longer need, as now the interception logic sits in mswjs/interceptors.

For me:
Why tests stuck if expect fails in req callback?