# Nock

HTTP Server mocking for Node.js

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

It will intercept an HTTP GET request to '/users/1' and reply with a status 404.

Then the test can call the module, and the module will do the HTTP requests.

## Specifying replies

You can specify the return status code for a path on the first argument of reply like this:

    var couchdb = nock('http://myapp.iriscouch.com')
                    .get('/users/1')
                    .reply(404);

You can also specify the reply body as a string:

    var couchdb = nock('http://www.google.com')
                    .get('/')
                    .reply(200, "Hello from Google!");

as a JSON-encoded object:

    var couchdb = nock('http://myapp.iriscouch.com')
                    .get('/')
                    .reply(200, {username: 'pgte', email: 'pedro.teixeira@gmail.com', _id: "4324243fsd"});

or even as a file:

    var couchdb = nock('http://myapp.iriscouch.com')
                    .get('/')
                    .replyWithFile(200, __dirname + '/replies/user.json');

## Chaining

You can chain behaviour like this:

    var couchdb = nock('http://myapp.iriscouch.com')
                    .get('/users/1')
                    .reply(404)
                    .post('/users', {username: 'pgte', email: 'pedro.teixeira@gmail.com'})
                    .reply(201, {ok: true, id: "123ABC", rev: "946B7D1C"})
                    .get('/users/123ABC')
                    .reply(200, {_id: "123ABC", _rev: "946B7D1C", username: 'pgte', email: 'pedro.teixeira@gmail.com'});


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

# How does it work?

Nock works by overriding Node's http.request function.