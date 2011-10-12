# Nock

Nock is an HTTP mocking and expectations library for Node.js

Nock can be used to test modules that perform HTTP requests in isolation.

For instance, if a module performs HTTP requests to a CouchDB server or makes HTTP requests to the Amazon API, you can test that module in isolation.

# Install

    $ npm install nock

# Use

On your test, you can setup your mocking object like this:

    var nock = require('nock');

    var couchdb = nock('http://myapp.iriscouch.com')
                    .get('/users/1')
                    .reply(200, {_id: "123ABC", _rev: "946B7D1C", username: 'pgte', email: 'pedro.teixeira@gmail.com'});

This setup says that we will intercept every HTTP call to `http://myapp.iriscouch.com`.

It will intercept an HTTP GET request to '/users/1' and reply with a status 200, and the body will contain a user representation in JSON.

Then the test can call the module, and the module will do the HTTP requests.

## Specifying replies

You can specify the return status code for a path on the first argument of reply like this:

    var scope = nock('http://myapp.iriscouch.com')
                    .get('/users/1')
                    .reply(404);

You can also specify the reply body as a string:

    var scope = nock('http://www.google.com')
                    .get('/')
                    .reply(200, "Hello from Google!");

or as a JSON-encoded object:

    var scope = nock('http://myapp.iriscouch.com')
                    .get('/')
                    .reply(200, {username: 'pgte', email: 'pedro.teixeira@gmail.com', _id: "4324243fsd"});

or even as a file:

    var scope = nock('http://myapp.iriscouch.com')
                    .get('/')
                    .replyWithFile(200, __dirname + '/replies/user.json');

## HTTP Verbs

Nock supports get, post, put and delete HTTP verbs.

## Chaining

You can chain behaviour like this:

    var scope = nock('http://myapp.iriscouch.com')
                    .get('/users/1')
                    .reply(404)
                    .post('/users', {username: 'pgte', email: 'pedro.teixeira@gmail.com'})
                    .reply(201, {ok: true, id: "123ABC", rev: "946B7D1C"})
                    .get('/users/123ABC')
                    .reply(200, {_id: "123ABC", _rev: "946B7D1C", username: 'pgte', email: 'pedro.teixeira@gmail.com'});


## Path filtering

You can also filter the URLs based on a function.

This can be useful, for instance, if you have random or time-dependent data in your URL.

You can use a regexp for replacement, just like String.prototype.replace:

    var scope = nock('http://api.myservice.com')
                    .filterPath(/password=[^&]*/g, 'password=XXX')
                    .get('/users/1?password=XXX')
                    .reply(200, 'user');

Or you can use a function:

    var scope = nock('http://api.myservice.com')
                    .filterPath(function(path) {
                       return '/ABC';
                     })
                    .get('/ABC')
                    .reply(200, 'user');

## Request Body filtering

You can also filter the request body based on a function.

This can be useful, for instance, if you have random or time-dependent data in your URL.

You can use a regexp for replacement, just like String.prototype.replace:

    var scope = nock('http://api.myservice.com')
                    .filterRequestBody(/password=[^&]*/g, 'password=XXX')
                    .post('/users/1', 'data=ABC&password=XXX')
                    .reply(201, 'OK');

Or you can use a function:

    var scope = nock('http://api.myservice.com')
                    .filterRequestBody(function(path) {
                       return 'ABC';
                     })
                    .post('/', 'ABC')
                    .reply(201, 'OK');

# Expectations

Every time an HTTP request is performed for a scope that is mocked, Nock expects to find a handler for it. If it doesn't, it will throw an error.

Calls to nock() return a scope which you can assert by calling `scope.done()`. This will assert that all specified calls on that scope were performed.

Example:

    var google = nock('http://google.com')
                    .get('/')
                    .reply(200, 'Hello from Google!');

    // do some stuff

    setTimeout(function() {
      google.done(); // will throw an assertion error if meanwhile a "GET http://google.com" was not performed.
    }, 5000);

# Logging

Nock can log matches if you pass in a log function like this:

    var google = nock('http://google.com')
                    .log(console.log)
                    ...

# How does it work?

Nock works by overriding Node's http.request function.