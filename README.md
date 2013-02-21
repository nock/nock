# Nock [![Build Status](https://secure.travis-ci.org/flatiron/nock.png)](http://travis-ci.org/flatiron/nock)

Nock is an HTTP mocking and expectations library for Node.js

Nock can be used to test modules that perform HTTP requests in isolation.

For instance, if a module performs HTTP requests to a CouchDB server or makes HTTP requests to the Amazon API, you can test that module in isolation.

# Install

```sh
$ npm install nock
```

# Use

On your test, you can setup your mocking object like this:

```js
var nock = require('nock');

var couchdb = nock('http://myapp.iriscouch.com')
                .get('/users/1')
                .reply(200, {_id: "123ABC", _rev: "946B7D1C", username: 'pgte', email: 'pedro.teixeira@gmail.com'});
```

This setup says that we will intercept every HTTP call to `http://myapp.iriscouch.com`.

It will intercept an HTTP GET request to '/users/1' and reply with a status 200, and the body will contain a user representation in JSON.

Then the test can call the module, and the module will do the HTTP requests.

## READ THIS

When you setup an interceptor for an URL and that interceptor is used, it is removed from the interceptor list.
This means that if you can intercept 2 or more calls to the same URL and return different things on each of them.
It also means that you must setup one interceptor for each request you are going to have, otherwise nock will throw an error because that URL was not present in the interceptor list.

## Specifying request body

You can specify the request body to be matched as the second argument to the `get`, `post`, `put` or `delete` specifications like this:

```js
var scope = nock('http://myapp.iriscouch.com')
                .post('/users', {username: 'pgte', email: 'pedro.teixeira@gmail.com'})
                .reply(201, {ok: true, id: "123ABC", rev: "946B7D1C"});
```

The request body can be a string or a JSON object.

## Specifying replies

You can specify the return status code for a path on the first argument of reply like this:

```js
var scope = nock('http://myapp.iriscouch.com')
                .get('/users/1')
                .reply(404);
```

You can also specify the reply body as a string:

```js
var scope = nock('http://www.google.com')
                .get('/')
                .reply(200, "Hello from Google!");
```

or as a JSON-encoded object:

```js
var scope = nock('http://myapp.iriscouch.com')
                .get('/')
                .reply(200, {username: 'pgte', email: 'pedro.teixeira@gmail.com', _id: "4324243fsd"});
```

or even as a file:

```js
var scope = nock('http://myapp.iriscouch.com')
                .get('/')
                .replyWithFile(200, __dirname + '/replies/user.json');
```

Instead of an object or a buffer you can also pass in a callback to be evaluated for the value of the response body:

```js
var scope = nock('http://www.google.com')
   .filteringRequestBody(/.*/, '*')
   .post('/echo', '*')
   .reply(201, function(uri, requestBody) {
     return requestBody;
   });
```

### Specifying Reply Headers

You can specify the reply headers like this:

```js
var scope = nock('http://www.headdy.com')
   .get('/')
   .reply(200, "Hello World!", {'X-My-Headers': 'My Header value'});
```

### Default Reply Headers

You can also specify default reply headers for all responses like this:

```js
var scope = nock('http://www.headdy.com')
  .defaultReplyHeaders({'X-Powered-By': 'Rails', 'Content-Type': 'application/json'})
  .get('/')
  .reply(200, 'The default headers should come too');
```

## HTTP Verbs

Nock supports any HTTP verb, and it has convenience methods for the GET, POST, PUT, HEAD, DELETE, PATCH and MERGE HTTP verbs.

You can intercept any HTTP verb using `.intercept(path, verb [, requestBody [, options]])`:

```js
scope('http://my.domain.com')
  .intercept('/path', 'PATCH')
  .reply(304);
```

## Support for HTTP and HTTPS

By default nock assumes HTTP. If you need to use HTTPS you can specify the `https://` prefix like this:

```js
var scope = nock('https://secure.my.server.com')
   // ...
```

## Non-standard ports

You are able to specify a non-standard port like this:

```js
var scope = nock('http://my.server.com:8081')
  ...
```

## Chaining

You can chain behaviour like this:

```js
var scope = nock('http://myapp.iriscouch.com')
                .get('/users/1')
                .reply(404)
                .post('/users', {username: 'pgte', email: 'pedro.teixeira@gmail.com'})
                .reply(201, {ok: true, id: "123ABC", rev: "946B7D1C"})
                .get('/users/123ABC')
                .reply(200, {_id: "123ABC", _rev: "946B7D1C", username: 'pgte', email: 'pedro.teixeira@gmail.com'});
```

## Path filtering

You can also filter the URLs based on a function.

This can be useful, for instance, if you have random or time-dependent data in your URL.

You can use a regexp for replacement, just like String.prototype.replace:

```js
var scope = nock('http://api.myservice.com')
                .filteringPath(/password=[^&]*/g, 'password=XXX')
                .get('/users/1?password=XXX')
                .reply(200, 'user');
```

Or you can use a function:

```js
var scope = nock('http://api.myservice.com')
                .filteringPath(function(path) {
                   return '/ABC';
                 })
                .get('/ABC')
                .reply(200, 'user');
```

## Request Body filtering

You can also filter the request body based on a function.

This can be useful, for instance, if you have random or time-dependent data in your URL.

You can use a regexp for replacement, just like String.prototype.replace:

```js
var scope = nock('http://api.myservice.com')
                .filteringRequestBody(/password=[^&]*/g, 'password=XXX')
                .post('/users/1', 'data=ABC&password=XXX')
                .reply(201, 'OK');
```

Or you can use a function:

```js
var scope = nock('http://api.myservice.com')
                .filteringRequestBody(function(path) {
                   return 'ABC';
                 })
                .post('/', 'ABC')
                .reply(201, 'OK');
```

## Request Headers Matching

If you need to match requests only if certain request headers match, you can.

```js
var scope = nock('http://api.myservice.com')
                .matchHeader('accept', 'application/json')
                .get('/')
                .reply(200, {data: "hello world"})
```

You can also use a regexp for the header body.

```js
var scope = nock('http://api.myservice.com')
                .matchHeader('User-Agent', /Mozilla\/.*/)
                .get('/')
                .reply(200, {data: "hello world"})
```

## Allow __unmocked__ requests on a mocked hostname

If you need some request on the same host name to be mocked and some others to **really** go through the HTTP stack, you can use the `allowUnmocked` option like this:

```js
options = {allowUnmocked: true};
var scope = nock('http://my.existing.service.com', options)
  .get('/my/url')
  .reply(200, 'OK!');

 // GET /my/url => goes through nock
 // GET /other/url => actually makes request to the server
```

# Expectations

Every time an HTTP request is performed for a scope that is mocked, Nock expects to find a handler for it. If it doesn't, it will throw an error.

Calls to nock() return a scope which you can assert by calling `scope.done()`. This will assert that all specified calls on that scope were performed.

Example:

```js
var google = nock('http://google.com')
                .get('/')
                .reply(200, 'Hello from Google!');

// do some stuff

setTimeout(function() {
  google.done(); // will throw an assertion error if meanwhile a "GET http://google.com" was not performed.
}, 5000);
```

## .isDone()

You can also call `isDone()`, which will return a boolean saying if all the expectations are met or not (instead of throwing an exception);

## .cleanAll()

You can cleanup all the prepared mocks (could be useful to cleanup some state after a failed test) like this:

```js
nock.cleanAll();
```
## .persist()

You can make all the interceptors for a scope persist by calling `.persist()` on it:

```js
var scope = nock('http://persisssists.con')
  .persist()
  .get('/')
  .reply(200, "Persisting all the way");
```

# Logging

Nock can log matches if you pass in a log function like this:

```js
var google = nock('http://google.com')
                .log(console.log)
                ...
```

# Restoring

You can restore the HTTP interceptor to the normal unmocked behaviour by calling:

```js
nock.restore();
```

# Turning Nock Off (experimental!)

You can bypass Nock completely by setting `NOCK_OFF` environment variable to `"true"`.

This way you can have your tests hit the real servers just by switching on this environment variable.

```js
$ NOCK_OFF=true node my_test.js
```

# Recording

This is a cool feature:

Guessing what the HTTP calls are is a mess, specially if you are introducing nock on your already-coded tests.

For these cases where you want to mock an existing live system you can record and playback the HTTP calls like this:

```js
nock.recorder.rec();
// Some HTTP calls happen and the nock code necessary to mock
// those calls will be outputted to console
```

If you just want to capture the generated code into a var as an array you can use:

```js
nock.recorder.rec(true); // :no_output = true
// ... some HTTP calls
var nockCalls = nock.recorder.play();
```

The `nockCalls` var will contain an array of strings representing the generated code you need.

Copy and paste that code into your tests, customize at will, and you're done!

(Remember that you should do this one test at a time).

# How does it work?

Nock works by overriding Node's `http.request` function. Also, it overrides `http.ClientRequest` too to cover for modules that use it directly.

# PROTIP

If you don't want to match the request body you can use this trick (by @theycallmeswift):

```js
var scope = nock('http://api.myservice.com')
  .filteringRequestBody(function(path) {
    return '*';
  })
  .post('/some_uri', '*')
  .reply(200, 'OK');
```

# License

(The MIT License)

Copyright (c) 2011 Pedro Teixeira. http://about.me/pedroteixeira

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
