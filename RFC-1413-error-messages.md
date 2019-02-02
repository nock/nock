# The Problem

Nock is very useful for faking out HTTP requests, but could do a better job of giving more useful feedback when a request does not match an interceptor

## Use Cases:

* Doing TDD, nock does not give a good incremental failure. A request either matches or it does not, and nock does not give feedback about how close/far you are from the mark.
* Sometimes libraries do not format requests in an expected way (`?attribute=value1&attribute=value2` vs `?attribute[]=value1&attribute[]=value2`) and nock could better help bring this to light.
  * other examples of this: configuring a client incorrectly, such that the client submits data as json instead of x-www-form-encoded (or vice versa)
* When there is a typo, it can be difficult to parse large chunks of text (request path/headers/body) in two different windows

# Proposals

## Provide an AssertionError

A very helpful format for failures is node's AssertionError (https://nodejs.org/docs/latest-v10.x/api/assert.html), which many test runners do a good job of providing a diff of what was supplied (request that did not match an interceptor) versus what was expected (nock's interceptor)

If there are very few nock interceptors (or only one) this would be good first incremental step in improving the usability of nock's error messages.

### Challenges
* An AssertionError only supportes one expected input, so *one* nock interceptor needs to be selected -- how to choose the best match?
  * Perform a string distance from the input and the request being evaluated? Jaro-Winkler?
  * Provide a list of nock interceptors that are close to the request, or for the same host?
* In order to provide a readable expected value, how should some of nock's interceptor attributes be stringified? Specifically, regexes are not going to provide a very good diff, for example.
  * as a first revision, stringified regexes are acceptable?
