8.0.0 / 2016-04-06
==================

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
  * changelog update

7.3.0 / 2016-02-24
==================

  * v7.3.0
  * browserify bundle update
  * Merge branch 'Limess-remove-interceptor-by-instance'
  * Call removeInterceptor() with instance
    Previously removeInterceptor() only took an options object. This was
    inconvenient if the client didn't wish to expose urls directly in their
    tests.
    removeInterceptor now also takes an instance of `Interceptor` and uses
    the instance variables `baseUrl` and `_key` to filter for removal.
    Added 3 test cases to cover http, https and regex path matching.
  * Use lodash size function
    You cannot effectively compare anything to an empty object declaration. {} === {} will always equal false. This is to address the attended purpose by the comment provided.
  * changelog update

7.2.2 / 2016-02-19
==================

  * v7.2.2
  * browserify bundle update
  * Merge branch 'mdlavin-v7-performance-improvement'
  * Increase test coverage of allowUnmocked when only mismatch is the body
  * Reuse _.defaults where possible to reduce code
  * Do not stringify request options unless they will be logged
  * Optimize for large number of interceptors
  * changelog update

7.2.1 / 2016-02-15
==================

  * v7.2.1
  * Merge branch 'owiber-oliver-callbackfix'
  * Merge branch 'oliver-callbackfix' of git://github.com/owiber/nock into owiber-oliver-callbackfix

7.2.0 / 2016-02-15
==================

  * v7.2.0
  * Merge branch 'master' of github.com:pgte/nock
  * mkdirp is optional because browsers. addresses [#475](https://github.com/node-nock/nock/issues/475)
  * fix key when interceptor path is specified with callback
  * Merge pull request [#465](https://github.com/node-nock/nock/issues/465) from JemiloII/patch-1
  * Fixing typos
  * added @BinChang as contributor
  * changelog update

7.1.0 / 2016-01-29
==================

  * v7.1.0
  * Merge branch 'BinChang-delayBody'
  * add a new api delayBody() and update the syntax of delay().
  * Merge pull request [#462](https://github.com/node-nock/nock/issues/462) from four43/patch-2
    Add clean all to example about being done with the test
  * Add clean all to example about being done with the test

7.0.2 / 2016-01-27
==================

  * v7.0.2
  * isStream test fixed for null objects

7.0.1 / 2016-01-27
==================

  * v7.0.1
  * for when content type header is an array. should fix [#460](https://github.com/node-nock/nock/issues/460)
  * Merge branch 'BinChang-common_is_stream'
  * remove isStream to the common lib.

7.0.0 / 2016-01-25
==================

  * v7.0.0
  * Merge branch 'wprater-patch-1'
  * Merge branch 'patch-1' of git://github.com/wprater/nock into wprater-patch-1
  * Merge branch 'BinChang-scope_interceptor'
  * updated broswerify bundle
  * Merge branch 'scope_interceptor' of git://github.com/BinChang/nock into BinChang-scope_interceptor
  * changelog update

6.0.1 / 2016-01-25
==================

  * v6.0.1
  * Merge branch 'alekbarszczewski-reply-headers-fix'
  * browserify bundle update
