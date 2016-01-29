7.1.0 / 2016-01-29
==================

  * Merge branch 'BinChang-delayBody'
  * add a new api delayBody() and update the syntax of delay().
  * Merge pull request [#462](https://github.com/pgte/nock/issues/462) from four43/patch-2
    Add clean all to example about being done with the test
  * Add clean all to example about being done with the test

7.0.2 / 2016-01-27
==================

  * v7.0.2
  * isStream test fixed for null objects

7.0.1 / 2016-01-27
==================

  * v7.0.1
  * for when content type header is an array. should fix [#460](https://github.com/pgte/nock/issues/460)
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
  * callback reply with array can now contain headers. fixes [#449](https://github.com/pgte/nock/issues/449)
  * skip test if node 0.10

5.3.1 / 2016-01-08
==================

  * browserify bundle update
  * Merge branch 'master' of github.com:pgte/nock

5.3.0 / 2016-01-08
==================

  * v5.3.0
  * buffer may not be an array
  * Merge pull request [#445](https://github.com/pgte/nock/issues/445) from pgte/emit-events
    no match emitted globally. fixes [#442](https://github.com/pgte/nock/issues/442)
  * no match emitted globally. fixes [#442](https://github.com/pgte/nock/issues/442)
  * Merge pull request [#443](https://github.com/pgte/nock/issues/443) from pgte/emit-events
    emit request and replied events
  * fixed test name
  * added event tests to test list
  * documented events
  * emit request and replied events
  * corrected test name
  * removed node test event sequence on abort, it's too inconsistent
  * reinstated delay test check. related to [#439](https://github.com/pgte/nock/issues/439)

5.2.1 / 2016-01-08
==================

  * changelog update
  * v5.2.1
  * browserify bundle update
  * emitting error on request abort. fixes [#439](https://github.com/pgte/nock/issues/439)

5.2.0 / 2016-01-07
==================

  * v5.2.0
  * scope now exposes interceptors

5.1.0 / 2016-01-07
==================

  * v5.1.0
  * abort behaves. somehow addresses [#439](https://github.com/pgte/nock/issues/439)

5.0.0 / 2016-01-05
==================

  * v5.0.0
  * Merge branch 'xavierchow-master'
  * browserify bundle update
  * Merge branch 'master' of git://github.com/xavierchow/nock into xavierchow-master
  * Upgrade to lodash 3.0, fix [#423](https://github.com/pgte/nock/issues/423)

4.1.0 / 2016-01-04
==================

  * v4.1.0
  * [docs] some readme clarifications on hostname and path matching
  * Merge branch 'feature/match-url-using-callback' of git://github.com/hyzhak/nock into hyzhak-feature/match-url-using-callback
  * Merge branch 'yinrong-master'
  * browserify bundle updated
  * [feature] allow matching body with RegExp
  * changelog update

4.0.0 / 2015-12-28
==================

  * changelog updated
  * v4.0.0
  * browserify bundle updated
  * Merge branch 'master' of git://github.com/ericsaboia/nock
  * [feature] allow specifying path using regex
  * [doc] clarified error-first callback behavior
  * updated browserify bundle
  * clarifying that replyWithError will emit an error on the request object, not the response
  * Merge branch 'ericsaboia-master'
  * Merge branch 'master' of git://github.com/ericsaboia/nock into ericsaboia-master
  * fix typo
  * match uri using callback
  * add ability to match domain using regex
  * updated changelog

3.6.0 / 2015-12-23
==================

  * v3.6.0
  * Merge pull request [#430](https://github.com/pgte/nock/issues/430) from jeffomatic/fix-request-again
    Update [#158](https://github.com/pgte/nock/issues/158) fix for request module and strict SSL
  * Update [#158](https://github.com/pgte/nock/issues/158) fix for request module and strict SSL
    Commit 48e8be5 added a compatibility fix for users of the request
    NPM module and strict SSL cert checking. The request module has
    since been updated (see https://github.com/request/request/pull/1615
    for more details), and a corresponding change should be made in
    nock to ensure compatibility.

3.5.0 / 2015-12-16
==================

  * v3.5.0
  * Merge branch 'aronwoost-multipart-fix'
  * Merge branch 'multipart-fix' of git://github.com/aronwoost/nock into aronwoost-multipart-fix

3.4.1 / 2015-12-15
==================

  * v3.4.1
  * removing empty query string parts before matching. Should fix [#426](https://github.com/pgte/nock/issues/426)
  * testing empty query string match
  * removing broken test
