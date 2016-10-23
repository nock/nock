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
  * Add optionally(), to replace and improve the undocumented 'requireDone'
  * Make pendingMocks and isDone behave consistently
  * Removed coverage folder from npm
  * Update PendingMocks when an interceptor is removed
  * Update CHANGELOG

8.1.0 / 2016-10-10
==================

  * 8.1.0
  * Enable harmony mode when running tests
  * Remove duplicated Interceptor.replyWithFile function
  * Merge pull request [#710](https://github.com/node-nock/nock/issues/710) from hugoduraes/master
    Leave rawHeaders case untouched on nock's replies
  * Leave rawHeaders case untouched on nock's replies
  * Re-enable previously skipped tests
  * Merge pull request [#586](https://github.com/node-nock/nock/issues/586) from Elergy/master
    Fix some broken tests
  * Add nodejs v6 to travis config
  * use public TravisCI badge icon, which shows failing tests.
  * Skip a couple of failing specs (until we get them fixed)
  * Remove tests/test.js
    Also:
    - Use nyc as the CLI of istanbul
    - Use tap binary directly for running tests
  * Support http OPTIONS method
  * Fix some issues to run library with Node v0.10:
    1. Set lodash version to ~4.9.0
    2. Add data-event listener for http's res message
  * Tests that depends on amazon.com's statusCode are fixed
    Symbol with charCode 160 is replaced to space
  * Merge pull request [#531](https://github.com/node-nock/nock/issues/531) from node-nock/greenkeeper-request-2.71.0
    Update request to version 2.71.0 🚀
  * Merge branch 'master' of github.com:node-nock/nock
  * added snyk vulerabilities badge
  * chore(package): update request to version 2.71.0
    http://greenkeeper.io/
  * Merge pull request [#528](https://github.com/node-nock/nock/issues/528) from mooyoul/improve-readme-toc
    Improved Table of Contents section of README
  * Changed `About Interceptors` title of TOC
    ... just to clarify
  * Lint README.md
  * Added some missing TOC entries
  * Fixed broken TOC link
  * changelog update

8.0.0 / 2016-04-06
==================

  * v8.0.0
  * added missing dep
  * Merge branch 'greenkeeper-request-2.70.0'
  * Merge branch 'master' into greenkeeper-request-2.70.0
  * making the latest version of lodash work
  * Merge pull request [#521](https://github.com/node-nock/nock/issues/521) from node-nock/greenkeeper-update-all
    Update all dependencies 🌴
  * fixes for latest tap version
  * chore(package): update request to version 2.70.0
    http://greenkeeper.io/
  * chore(package): update dependencies
    http://greenkeeper.io/

7.7.3 / 2016-04-04
==================

  * v7.7.3
  * Merge pull request [#520](https://github.com/node-nock/nock/issues/520) from ericsaboia/master
    properly remove interceptor with regex domain from the list after used
  * properly remove interceptor with regex domain from the list after used
  * Merge pull request [#519](https://github.com/node-nock/nock/issues/519) from Byron-TW/patch-1
    Fix typo
  * Fix typo
  * changelog update

7.7.2 / 2016-03-25
==================

  * v7.7.2
  * v7.7.1
  * Merge branch 'master' of github.com:node-nock/nock

7.7.0 / 2016-03-25
==================

  * v7.7.0
  * Merge pull request [#514](https://github.com/node-nock/nock/issues/514) from kevinburkeshyp/fix-req-no-match
    Fix nock.emitter.on('no match') undefined argument
  * Merge pull request [#512](https://github.com/node-nock/nock/issues/512) from kevinburkeshyp/fix-typo
    Fix typo in tests
  * browserify bundle update
  * request abort destroys socket. fixes [#511](https://github.com/node-nock/nock/issues/511)
  * Fix nock.emitter.on('no match') undefined argument
    Previously if you disabled net connect via `nock.disableNetConnect`,
    `nock.emitter.on('no match')` would return undefined for its first argument,
    since `req` is never initialized. Replaces `req` with `options`, which is
    present and set to a Url instance.
    Fixes the global nock.emitter.on event listener to remove all event listeners
    at the end of each test, otherwise an event listener registered in one test
    might bleed over into the next.
    (This might not be the right fix, I'm happy to change as necessary).
  * Fix typo in tests

7.6.0 / 2016-03-25
==================

  * v7.6.0
  * Merge pull request [#509](https://github.com/node-nock/nock/issues/509) from mihar/patch-2
    Update README.md
  * Merge pull request [#510](https://github.com/node-nock/nock/issues/510) from RedCattleWealth/master
    query accept a function to determine if the query is matched
  * update README
  * query accept a function to determin if the query is matched
    for some case object compare is not enough
  * Update README.md
  * Merge pull request [#501](https://github.com/node-nock/nock/issues/501) from reconbot/patch-1
    Make the source of NetConnectNotAllowedError clear
  * changelog update

7.5.0 / 2016-03-20
==================

  * v7.5.0
  * Merge branch 'satazor-back-recorder-options'
  * Merge branch 'back-recorder-options' of git://github.com/satazor/nock into satazor-back-recorder-options
  * Merge branch 'satazor-request-promise'
  * Add ability to pass options to recorder from nodeback.
  * Do not automatically consume responses, respect original consumer.
  * Make the source of NetConnectNotAllowedError clear
  * Merge pull request [#480](https://github.com/node-nock/nock/issues/480) from JemiloII/patch-1
    Use lodash size function
  * coveralls badge url
  * switched repo token
  * pgte -> node-nock
  * Merge branch 'master' of github.com:pgte/nock
  * testing for [#496](https://github.com/node-nock/nock/issues/496)
  * Merge pull request [#494](https://github.com/node-nock/nock/issues/494) from mihar/patch-1
    README.md: Fix typo
  * README.md: Fix typo
  * v7.4.0

7.4.0 / 2016-03-04
==================

  * Merge branch 'swashcap-bug/[#489](https://github.com/node-nock/nock/issues/489)-reply-callback'
  * browserify bundle update
  * Merge branch 'bug/[#489](https://github.com/node-nock/nock/issues/489)-reply-callback' of git://github.com/swashcap/nock into swashcap-bug/[#489](https://github.com/node-nock/nock/issues/489)-reply-callback
  * Add support for full callback `reply()`.
    This addresses a bug with the `reply()` function where a request without
    a body caused full callbacks to error. (See pgte/nock[#489](https://github.com/node-nock/nock/issues/489))
