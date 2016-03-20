7.5.0 / 2016-03-20
==================

  * v7.5.0
  * Merge branch 'satazor-back-recorder-options'
  * Merge branch 'back-recorder-options' of git://github.com/satazor/nock into satazor-back-recorder-options
  * Merge branch 'satazor-request-promise'
  * Add ability to pass options to recorder from nodeback.
  * Do not automatically consume responses, respect original consumer.
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
  * dont execute `replace` on a non-string 
    recorded bodies can be an object (json).  dont try to use a string function on them.
  * rebase with master
  * move interceptor to its own file.
  * split scope and intercept
  * Fixed issue with header function evaluation + added 2 tests
  * changelog update

6.0.0 / 2016-01-21
==================

  * v6.0.0
  * Merge branch 'BinChang-complex_query_string'
  * add qs into package dependency block.
  * add test_complex_querystring into test list
  * minor update
  * support complex GET query based the behavior of request module.
  * changelog update

5.5.0 / 2016-01-19
==================

  * v5.5.0
  * Merge branch 'BinChang-parse_json_content'
  * clean up tests
  * parse requestBody if it is JSON content.

5.4.0 / 2016-01-18
==================

  * v5.4.0
  * callback reply with array can now contain headers. fixes [#449](https://github.com/node-nock/nock/issues/449)
  * skip test if node 0.10

5.3.1 / 2016-01-08
==================

  * browserify bundle update
  * Merge branch 'master' of github.com:pgte/nock

5.3.0 / 2016-01-08
==================

  * v5.3.0
  * buffer may not be an array
  * Merge pull request [#445](https://github.com/node-nock/nock/issues/445) from pgte/emit-events
    no match emitted globally. fixes [#442](https://github.com/node-nock/nock/issues/442)
  * no match emitted globally. fixes [#442](https://github.com/node-nock/nock/issues/442)
  * Merge pull request [#443](https://github.com/node-nock/nock/issues/443) from pgte/emit-events
    emit request and replied events
  * fixed test name
  * added event tests to test list
  * documented events
  * emit request and replied events
  * corrected test name
  * removed node test event sequence on abort, it's too inconsistent
