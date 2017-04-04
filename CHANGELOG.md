9.0.9 / 2017-02-28
==================

  * 9.0.9: Revert PR [#802](https://github.com/node-nock/nock/issues/802)
  * Merge pull request [#840](https://github.com/node-nock/nock/issues/840) from node-nock/revert-802-fix-754
    Revert "Fix request timeout no working"
  * Revert "Fix request timeout no working"
  * Changelog v9.0.8

9.0.8 / 2017-02-27
==================

  * 9.0.8: Fix for [#754](https://github.com/node-nock/nock/issues/754)
  * Merge pull request [#836](https://github.com/node-nock/nock/issues/836) from node-nock/greenkeeper-superagent-3.5.0
    Update superagent to version 3.5.0 🚀
  * Merge pull request [#802](https://github.com/node-nock/nock/issues/802) from aleung/fix-754
    Fix request timeout no working

9.0.7 / 2017-02-23
==================

  * Changelog
  * 9.0.7: Fix for [#610](https://github.com/node-nock/nock/issues/610)
  * Merge pull request [#829](https://github.com/node-nock/nock/issues/829) from yodeyer/fixQs
    Fix interceptor if query have no query strings
  * chore(package): update superagent to version 3.5.0
    https://greenkeeper.io/
  * Test against request 2.79.0, with which timeout issue occured.
  * Add Visual Studio Code folder into gitignore
  * Update the failed test case
  * Fix https://github.com/node-nock/nock/issues/754

9.0.6 / 2017-02-13
==================

  * 9.0.6: Fix for [#827](https://github.com/node-nock/nock/issues/827)
  * Merge pull request [#828](https://github.com/node-nock/nock/issues/828) from node-nock/bug-827-matchStringOrRegexp
    Bug [#827](https://github.com/node-nock/nock/issues/827) Defensive coding around target
  * Bug [#827](https://github.com/node-nock/nock/issues/827) Defensive coding around target
  * Fail if interceptor has query parameters but not the query

9.0.5 / 2017-02-10
==================

  * 9.0.5: Various bug fixes
  * Merge pull request [#822](https://github.com/node-nock/nock/issues/822) from KingHenne/fix/isomorphic-fetch-basic-auth
    Fix isomorphic fetch usage with basicAuth/matchHeader
  * Merge pull request [#823](https://github.com/node-nock/nock/issues/823) from KingHenne/fix/nyc-config
    Exclude test files from coverage reports
  * Merge pull request [#769](https://github.com/node-nock/nock/issues/769) from RubenVerborgh/fix-socket-this
    Fix this pointer on "socket" event
  * exclude test files from coverage reports
  * add text summary coverage reporter
  * fix basicAuth/matchHeader interceptors with isomorphic-fetch
  * add failing test for isomorphic-fetch and matchHeader
  * add failing test for isomorphic-fetch and basicAuth
  * Merge pull request [#821](https://github.com/node-nock/nock/issues/821) from node-nock/chore-changelog-v9.0.4
    Update changelog using "npm run changelog"
  * Update changelog using "npm run changelog"

9.0.4 / 2017-02-07
==================

  * 9.0.4: Fix bug where only single set-cookie header would be returned
  * Merge pull request [#820](https://github.com/node-nock/nock/issues/820) from node-nock/bug-818-multiple-set-cookie
    Bug 818 multiple set cookie
  * Merge pull request [#813](https://github.com/node-nock/nock/issues/813) from node-nock/greenkeeper-tap-10.0.0
    Update tap to version 10.0.0 🚀
  * Bug [#818](https://github.com/node-nock/nock/issues/818) Assert mutiple set-cookie headers are included in object
  * Bug [#818](https://github.com/node-nock/nock/issues/818) Send back multiple headers if multiple present

9.0.3 / 2017-02-06
==================

  * 9.0.3: Change error message for unmatched requests
  * Merge pull request [#819](https://github.com/node-nock/nock/issues/819) from node-nock/chore-add-ian-contrib
    Add Ian WS to contrib
  * Add Ian WS to contrib
  * Merge pull request [#597](https://github.com/node-nock/nock/issues/597) from ianwsperber/feature-better-unmatched-request-error
    Better unmatched request error
  * chore(package): update tap to version 10.0.0
    https://greenkeeper.io/
  * Merge pull request [#799](https://github.com/node-nock/nock/issues/799) from node-nock/greenkeeper-tap-9.0.3
    Update tap to version 9.0.3 🚀
  * Merge pull request [#797](https://github.com/node-nock/nock/issues/797) from Thebigbignooby/patch-1
    Fix typo in README
  * Use pretty JSON and no longer stringify body
  * Only include body in stringified request for non-GET requests
  * Update intercept tests for new stringified format
  * Format stringified request as JSON and include headers
  * Baseline test for common.stringifyRequest
  * chore(package): update tap to version 9.0.3
    https://greenkeeper.io/
  * fix typo
    URL begins with a hard u, pronounced "you" and so should be preceded by "a", not "an"
  * Set `this` to request on socket event.
    This makes behavior consistent with the Node.js HTTP module
    (https://github.com/nodejs/node/blob/v6.0.0/lib/_http_client.js#L541).
  * Merge pull request [#757](https://github.com/node-nock/nock/issues/757) from node-nock/greenkeeper-tap-8.0.1
    Update tap to version 8.0.1 🚀
  * Add test for delay/timeout
  * chore(package): update tap to version 8.0.1
    https://greenkeeper.io/
  * Merge pull request [#755](https://github.com/node-nock/nock/issues/755) from node-nock/greenkeeper-lodash-4.17.2
    Update lodash to version 4.17.2 🚀
  * chore(package): update lodash to version 4.17.2
    https://greenkeeper.io/
  * Merge pull request [#760](https://github.com/node-nock/nock/issues/760) from node-nock/greenkeeper-nyc-10.0.0
    Update nyc to version 10.0.0 🚀
  * chore(package): update nyc to version 10.0.0
    https://greenkeeper.io/
  * Merge pull request [#683](https://github.com/node-nock/nock/issues/683) from szdavid92/feat/gzip-content-type-decoder
    Add gzip and deflate decoder for json content type
  * Merge pull request [#743](https://github.com/node-nock/nock/issues/743) from node-nock/greenkeeper-zombie-5.0.1
    Update zombie to version 5.0.1 🚀
  * Merge pull request [#738](https://github.com/node-nock/nock/issues/738) from node-nock/greenkeeper-lodash-4.16.6
    Update lodash to version 4.16.6 🚀
  * chore(package): update zombie to version 5.0.1
    https://greenkeeper.io/
  * chore(package): update lodash to version 4.16.6
    https://greenkeeper.io/
  * fix wording
  * add gzip and deflate decoder for json content type
  * Add nodejs v7 to travis config
  * Update CHANGELOG

9.0.2 / 2016-10-28
==================

  * 9.0.2
  * Merge branch 'airplane'
  * Update CHANGELOG

9.0.1 / 2016-10-28
==================

  * 9.0.1
  * Merge pull request [#734](https://github.com/node-nock/nock/issues/734) from RobertWHurst/master
    Fixes regression introduced by [#719](https://github.com/node-nock/nock/issues/719)
  * Implement AIRPLANE mode to skip internet-dependent tests
  * Utilize tap's skip functionality to toggle tests based on available features
  * Add more notes on contributing section
  * Move "How does it work?" section to the top of the README
  * Fix [#731](https://github.com/node-nock/nock/issues/731)
  * test for empty object in body
  * Update README & CHANGELOG

9.0.0 / 2016-10-23
==================

  * 9.0.0
  * Drop support for node versions 0.10, 0.11, 0.12 and 5
  * Add section on node versions support
  * Update CHANGELOG

8.2.0 / 2016-10-23
==================

  * 8.2.0
  * Add changelog to the dev dependencies
  * Ignore browserify-bundle.js
  * Update browserify-bundle.js
  * Merge pull request [#723](https://github.com/node-nock/nock/issues/723) from pimterry/optional-mocks
    Add optionally() and make isDone and pendingMocks consistent.
  * Include all review markup changes in browserify-bundle
  * Add .activeMocks() to recreate previous .pendingMocks() behaviour
  * Add times+optional and persist+optional tests
  * Document assumption in pendingMocks()
  * Clarify optional mock behaviour a little in README
  * Merge pull request [#721](https://github.com/node-nock/nock/issues/721) from pimterry/removeInterceptor-from-pending
    Update PendingMocks when an interceptor is removed
  * Merge pull request [#722](https://github.com/node-nock/nock/issues/722) from Ginden/no-garbage-in-npm
    Removed coverage folder from npm
  * Merge pull request [#668](https://github.com/node-nock/nock/issues/668) from abdulito/master
    Support http OPTIONS method
  * Merge pull request [#725](https://github.com/node-nock/nock/issues/725) from node-nock/greenkeeper-async-2.1.1
    Update async to version 2.1.1 🚀
  * Merge pull request [#719](https://github.com/node-nock/nock/issues/719) from ltegman/fix/body-spec-regex-in-array
    Handle arrays like objects in match_body
  * Handle arrays like objects in match_body
  * chore(package): update async to version 2.1.1
    https://greenkeeper.io/
  * Ad documentation for optionally()
