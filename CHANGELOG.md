9.0.22 / 2017-09-27
===================

  * fix: query string recording where value is an array ([#917](https://github.com/node-nock/nock/issues/917))
  * docs(README): link to license file, link to contributors, update Copyright years
  * chore(LICENSE): MIT
  * chore(CHANGELOG): v9.0.21

9.0.21 / 2017-09-25
===================

  * 9.0.21
  * fix: compare falsy header values & numbers correctly
  * test: match number header values
  * multiple interceptors override headers from unrelated requests
  * Add an error code to NetConnectNotAllowedError
    This is in line with nodejs error codes. I chose `ENETUNREACH` because it clearly defines the reason why the http request failed.
    https://nodejs.org/api/all.html#errors_error_code
  * chore(CHANGELOG): v9.0.20

9.0.20 / 2017-09-24
===================

  * 9.0.20
  * fix: match headers with falsy values (again)
    follow up for https://github.com/node-nock/nock/pull/973/files#r140647611
  * Switch from jshint to eslint ([#885](https://github.com/node-nock/nock/issues/885))
    - Remove pre-commit hooks
    - Fix a broken unit test (bug caught by lint)
    - Minor lint + style cleanup
    Closes [#868](https://github.com/node-nock/nock/issues/868)
  * changed Real HTTP request documentation to be more readable
  * docs(CHANGELOG): 9.0.19

9.0.19 / 2017-09-22
===================

  * 9.0.19
  * Improve Nock Back documentation
  * Fix file permissions of intercept test
  * Fix allowUnmocked when last interceptor was removed.
  * Do not abort a an already aborted request, do not emit an error twice
    Fixes [#882](https://github.com/node-nock/nock/issues/882)
    When a request is aborted, "nock" emits an "abort"-error.
    If the client reacts on that error by aborting the request (this is what
    "popsicle" does), the code will end in an endless loop.
    This commit makes that the the "abort"-code is only executed, if the
    request has not already been aborted.
  * fix broken link: allow-unmocked-requests-on-a-mocked-hostname
  * fix: Specified request body not properly enforced ([#921](https://github.com/node-nock/nock/issues/921))
  * Minor change in example code `scope(` => `var scope = nock(`
  * nockBack.setMode: Improve error message
  * chore(CHANGELOG): v9.0.18

9.0.18 / 2017-09-20
===================

  * 9.0.18
  * fix(recorder): don’t JSON.stringify output if output_objects is not enabled
    This is a follow up fix for https://github.com/node-nock/nock/pull/959
  * feat: promisify nock back ([#798](https://github.com/node-nock/nock/issues/798))
  * chore(CHANGELOG) v9.0.17

9.0.17 / 2017-09-19
===================

  * 9.0.17
  * 835 support regex for both host and port with allowUnmocked
  * 835-added-fail-test-case
  * docs(README) - fix info about mocking ([#971](https://github.com/node-nock/nock/issues/971))
  * Document replyWithFile using Content-Type header
  * fix readme typo
    add missing closing paren
  * fix grammar
    change `the response event will occur immediately, but the IncomingMessage not it's end event until after the delay` -> `the response event will occur immediately, but the IncomingMessage will not emit it's end event until after the delay`
  * Improve Match Logging
    Currently, matching logging does not include the method or path of the request.  I have added these to make debugging non-matches easier.
  * Update README.md
    please review for accuracy. I actually don't know how it behaves but this section was very confusing to read.
  * fix: printing recorded requests with output_objects resulted in output of [Object Object]
  * chore(CHANGELOG): 9.0.16

9.0.16 / 2017-09-18
===================

  * 9.0.16
  * fix: match headers with falsy values
  * test: match headers with falsy values
  * chore(travis): don’t build twice for PRs and retry npm install
  * chore(travis): don’t test in node v7
    It’s no longer supported
  * chore: remove console logs in tests
  * docs(CHANGELOG): update for 9.0.15

9.0.15 / 2017-09-18
===================

  * 9.0.15
  * fix: `nock.define()` respects badheaders option
  * test: `nock.define()` ignores badheaders option
  * docs(README): document `nock.recorder.clear()`

9.0.14 / 2017-07-17
===================

  * Fixes for Node 8
  * Merge pull request [#948](https://github.com/node-nock/nock/issues/948) from martinkuba/master
    Fix for [#947](https://github.com/node-nock/nock/issues/947)
  * www.amazon.com does not return any data
  * Merge pull request [#929](https://github.com/node-nock/nock/issues/929) from martinkuba/node8
    Updates to unblock Node 8
  * Merge pull request [#942](https://github.com/node-nock/nock/issues/942) from michaelnisi/browserify
    Skip browserify test because zombie fails @7.10
  * Skip browserify test because zombie fails @7.10
  * wrap http.get on Node 8 only
  * workaround for socket hang up
  * fix recorder when calling res.end(data)
  * use req.setHeader()
  * override http.get
  * added Node 8 to Travis
  * Merge pull request [#667](https://github.com/node-nock/nock/issues/667) from ksmith97/master
    Updated debug namespace to match file.

9.0.13 / 2017-04-10
===================

  * 9.0.13: Revert [#863](https://github.com/node-nock/nock/issues/863)
  * Merge pull request [#880](https://github.com/node-nock/nock/issues/880) from node-nock/revert-v9.0.12-issue-863
    Revert "Merge branch 'fasterize-fix_match_body'"
  * Revert "Merge branch 'fasterize-fix_match_body'"
    This reverts commit 8333e3aef1e79dc2ed96dca819124f4a18f1af4d, reversing
    changes made to 30881e2a72dbb950e771f912c5f9ddbcb91c0acd.

9.0.12 / 2017-04-10
===================

  * 9.0.12: Use key length in array/object comparison
  * Merge branch 'fasterize-fix_match_body'
    * fasterize-fix_match_body:
    [[#863](https://github.com/node-nock/nock/issues/863)] Fix matchBody for object and array comparison
  * Merge branch 'fix_match_body' of https://github.com/fasterize/nock into fasterize-fix_match_body
    * 'fix_match_body' of https://github.com/fasterize/nock:
    [[#863](https://github.com/node-nock/nock/issues/863)] Fix matchBody for object and array comparison
  * [[#863](https://github.com/node-nock/nock/issues/863)] Fix matchBody for object and array comparison

9.0.11 / 2017-03-29
===================

  * 9.0.11: Fixes for [#856](https://github.com/node-nock/nock/issues/856) (pending mocks) and [#425](https://github.com/node-nock/nock/issues/425) (multipart forms)
  * Merge pull request [#834](https://github.com/node-nock/nock/issues/834) from delijati/master
    PR [#834](https://github.com/node-nock/nock/issues/834): Don't remove newlines from multipart form reqests
  * Merge pull request [#857](https://github.com/node-nock/nock/issues/857) from disrupticons/fixing-issue-856
    Fix [#856](https://github.com/node-nock/nock/issues/856): nock.cleanAll() should remove pending mocks
  * fixing test description

9.0.10 / 2017-03-28
===================

  * 9.0.10: Versioned tested and better .npmignore
  * adding test for multipart match body
  * Merge pull request [#858](https://github.com/node-nock/nock/issues/858) from fabiosantoscode/patch-1
    Add some big folders to .npmignore
  * Add some big folders to .npmignore
  * Remove pending mocks from scopes on nock.cleanAll()
  * Merge pull request [#842](https://github.com/node-nock/nock/issues/842) from node-nock/feature-832-versioned-tests
    Feature [#832](https://github.com/node-nock/nock/issues/832): Versioned tests
  * [#832](https://github.com/node-nock/nock/issues/832) Add glob as dev dep
  * [#832](https://github.com/node-nock/nock/issues/832) Add integration tests to travis
  * [#832](https://github.com/node-nock/nock/issues/832) Cleanup sub dep install script
  * [#832](https://github.com/node-nock/nock/issues/832) Add tests for request & popsicle
  * [#832](https://github.com/node-nock/nock/issues/832) Remove socketTimeout test
  * [#832](https://github.com/node-nock/nock/issues/832) Run got tests using common test runner
  * 832 Versioned tests for got module
  * 832 Add sub dep install from NR
  * Changelog v9.0.9

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
