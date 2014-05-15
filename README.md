# Nock [![Build Status](https://secure.travis-ci.org/pgte/nock.png)](http://travis-ci.org/pgte/nock)

Nock is an HTTP mocking and expectations library for Node.js

Nock can be used to test modules that perform HTTP requests in isolation.

For instance, if a module performs HTTP requests to a CouchDB server or makes HTTP requests to the Amazon API, you can test that module in isolation.

This does NOT work with Browserify, only node.js


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
                .reply(200, {
                  _id: '123ABC',
                  _rev: '946B7D1C',
                  username: 'pgte',
                  email: 'pedro.teixeira@gmail.com'
                 });
```

This setup says that we will intercept every HTTP call to `http://myapp.iriscouch.com`.

It will intercept an HTTP GET request to '/users/1' and reply with a status 200, and the body will contain a user representation in JSON.

Then the test can call the module, and the module will do the HTTP requests.

## READ THIS

When you setup an interceptor for an URL and that interceptor is used, it is removed from the interceptor list.
This means that you can intercept 2 or more calls to the same URL and return different things on each of them.
It also means that you must setup one interceptor for each request you are going to have, otherwise nock will throw an error because that URL was not present in the interceptor list.

## Specifying request body

You can specify the request body to be matched as the second argument to the `get`, `post`, `put` or `delete` specifications like this:

```js
var scope = nock('http://myapp.iriscouch.com')
                .post('/users', {
                  username: 'pgte',
                  email: 'pedro.teixeira@gmail.com'
                })
                .reply(201, {
                  ok: true,
                  id: '123ABC',
                  rev: '946B7D1C'
                });
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
                .reply(200, 'Hello from Google!');
```

or as a JSON-encoded object:

```js
var scope = nock('http://myapp.iriscouch.com')
                .get('/')
                .reply(200, {
                  username: 'pgte',
                  email: 'pedro.teixeira@gmail.com',
                  _id: '4324243fsd'
                });
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


A Stream works too:
```js
var scope = nock('http://www.google.com')
   .get('/cat-poems')
   .reply(200, function(uri, requestBody) {
     return fs.createReadStream('cat-poems.txt');
   });
```

### Specifying Request Headers

You can specify the request headers like this:

```
var scope = nock('http://www.example.com', {
  reqheaders: {
    'authorization': 'Basic Auth'
  }
})
   .get('/')
   .reply(200);
```

If `reqheaders` is not specified or if `host` is not part of it, Nock will automatically add `host` value to request header.

### Specifying Reply Headers

You can specify the reply headers like this:

```js
var scope = nock('http://www.headdy.com')
   .get('/')
   .reply(200, 'Hello World!', {
     'X-My-Headers': 'My Header value'
   });
```

### Default Reply Headers

You can also specify default reply headers for all responses like this:

```js
var scope = nock('http://www.headdy.com')
  .defaultReplyHeaders({
    'X-Powered-By': 'Rails',
    'Content-Type': 'application/json'
  })
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

## Repeat response n times

You are able to specify the number of times to repeat the same response.

```js
nock('http://zombo.com').get('/').times(4).reply(200, 'Ok');

http.get('http://zombo.com/'); // respond body "Ok"
http.get('http://zombo.com/'); // respond body "Ok"
http.get('http://zombo.com/'); // respond body "Ok"
http.get('http://zombo.com/'); // respond body "Ok"
http.get('http://zombo.com/'); // respond with zombo.com result
```

Sugar sintaxe

```js
nock('http://zombo.com').get('/').once().reply(200, 'Ok');
nock('http://zombo.com').get('/').twice().reply(200, 'Ok');
nock('http://zombo.com').get('/').thrice().reply(200, 'Ok');
```

## Delay the response

You are able to specify the number of milliseconds that your reply should be delayed.

```js
nock('http://my.server.com')
  .get('/')
  .delay(2000) // 2 seconds
  .reply(200, '<html></html>')
```

NOTE: the [`'response'`](http://nodejs.org/api/http.html#http_event_response) event will occur immediately, but the [IncomingMessage](http://nodejs.org/api/http.html#http_http_incomingmessage) not emit it's `'end'` event until after the delay.

## Delay the connection

You are able to specify the number of milliseconds that your connection should be delayed.

```js
nock('http://my.server.com')
  .get('/')
  .delayConnection(2000) // 2 seconds
  .reply(200, '<html></html>')
```

## Chaining

You can chain behaviour like this:

```js
var scope = nock('http://myapp.iriscouch.com')
                .get('/users/1')
                .reply(404)
                .post('/users', {
                  username: 'pgte',
                  email: 'pedro.teixeira@gmail.com'
                })
                .reply(201, {
                  ok: true,
                  id: '123ABC',
                  rev: '946B7D1C'
                })
                .get('/users/123ABC')
                .reply(200, {
                  _id: '123ABC',
                  _rev: '946B7D1C',
                  username: 'pgte',
                  email: 'pedro.teixeira@gmail.com'
                });
```

## Scope filtering

You can filter the scope (protocol, domain and port through) of a nock through a function. This filtering functions is defined at the moment of defining the nock's scope through its optional `options` parameters:

This can be useful, for instance, if you have a node moduel that randomly changes subdomains to which it sends requests (e.g. Dropbox node module is like that)

```js
var scope = nock('https://api.dropbox.com', {
  filteringScope: function(scope) {
    return /^https:\/\/api[0-9]*.dropbox.com/.test(scope);
  })
  .get('/1/metadata/auto/Photos?include_deleted=false&list=true')
  .reply(200);
}
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

This can be useful, for instance, if you have random or time-dependent data in your request body.

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
                .reply(200, {
                  data: 'hello world'
                })
```

You can also use a regexp for the header body.

```js
var scope = nock('http://api.myservice.com')
                .matchHeader('User-Agent', /Mozilla\/.*/)
                .get('/')
                .reply(200, {
                  data: 'hello world'
                })
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
  .reply(200, 'Persisting all the way');
```

## pendingMocks

If a scope is not done, you can inspect the scope to infer which ones are still pending using the `scope.pendingMocks` property:

```js
if (!scope.isDone()) {
  console.error('pending mocks: %j', scope.pendingMocks);
}
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

# Enable/Disable real HTTP request

As default, if you do not mock a host, a real HTTP request will do, but sometimes you should not permit real HTTP request, so...

For disable real http request.

```js
nock.disableNetConnect();
```

So, if you try to request any host not 'nocked', it will thrown an NetConnectNotAllowedError.

```js
nock.disableNetConnect();
http.get('http://google.com/');
// this code throw NetConnectNotAllowedError with message:
// Nock: Not allow net connect for "google.com:80"
```

For enabled real HTTP requests.

```js
nock.enableNetConnect();
```

You could restrict real HTTP request...

```js
// using a string
nock.enableNetConnect('amazon.com');

// or a RegExp
nock.enableNetConnect(/(amazon|github).com/);

http.get('http://www.amazon.com/');
http.get('http://github.com/'); // only for second example

// This request will be done!
http.get('http://google.com/');
// this will throw NetConnectNotAllowedError with message:
// Nock: Not allow net connect for "google.com:80"
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
nock.recorder.rec({
  dont_print: true
});
// ... some HTTP calls
var nockCalls = nock.recorder.play();
```

The `nockCalls` var will contain an array of strings representing the generated code you need.

Copy and paste that code into your tests, customize at will, and you're done!

(Remember that you should do this one test at a time).

In case you want to generate the code yourself or use the test data in some other way, you can pass the `output_objects` option to `rec`:

```js
nock.recorder.rec({
  output_objects: true
});
// ... some HTTP calls
var nockCallObjects = nock.recorder.play();
```

The returned call objects have the following properties:

 `scope` - the scope of the call including the protocol and non-standard ports (e.g. `'https://github.com:12345'`)

 `method` - the HTTP verb of the call (e.g. `'GET'`)

 `path` - the path of the call (e.g. `'/pgte/nock'`)

 `body` - the body of the call, if any

 `status` - the HTTP status of the reply (e.g. `200`)

 `response` - the body of the reply which can be a JSON, string, hex string representing binary buffers or an array of such hex strings (when handling `content-encoded` in reply header)

 `headers` - the headers of the reply

 `reqheader` - the headers of the request

If you save this as a JSON file, you can load them directly through `nock.load(path)`. Then you can post-process them before using them in the tests for example to add them request body filtering (shown here fixing timestamps to match the ones captured during recording):

```js
nocks = nock.load(pathToJson);
nocks.forEach(function(nock) {
  nock.filteringRequestBody = function(body) {
    if(typeof(body) !== 'string') {
      return body;
    }

    return body.replace(/(timestamp):([0-9]+)/g, function(match, key, value) {
      return key + ':timestampCapturedDuringRecording'
    });
  };
});
```

Alternatively, if you need to pre-process the captured nock definitions before using them (e.g. to add scope filtering) then you can use `nock.loadDefs(path)` and `nock.define(nockDefs)`. Shown here is scope filtering for Dropbox node module which constantly changes the subdomain to which it sends the requests:

```js
//  Pre-process the nock definitions as scope filtering has to be defined before the nocks are defined (due to its very hacky nature).
var nockDefs = nock.loadDefs(pathToJson);
nockDefs.forEach(function(def) {
  //  Do something with the definition object e.g. scope filtering.
  def.options = def.options || {};
  def.options.filteringScope = function(scope) {
    return /^https:\/\/api[0-9]*.dropbox.com/.test(scope);
  };
}

//  Load the nocks from pre-processed definitions.
var nocks = nock.define(nockDefs);
```

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
