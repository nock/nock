# Nock

HTTP Server mocking for Node.js

Nock can be used to test modules that perform HTTP requests in isolation.

For instance, if a module performs HTTP requests to a CouchDB server or makes HTTP requests to the Amazon API, you can test that module in isolation.

## Install

    $ npm install nock

## Use

On your test, you can setup your mocking object like this:

    var nock = require('nock');

    var couchdb = nock('http://myapp.iriscouch.com')
                    .get('/users/1')
                    .reply(404)
                    .post('/users', {username: 'pgte', email: 'pedro.teixeira@gmail.com'})
                    .reply(201, {ok: true, id: "123ABC", rev: "946B7D1C"})
                    .get('/users/123ABC')
                    .reply(200, {_id: "123ABC", _rev: "946B7D1C", username: 'pgte', email: 'pedro.teixeira@gmail.com'});

This setup says that we will intercept every call to

Then the test can call the module, and the module will do the HTTP requests.

Every HTTP request to `myapp.iriscouch.com` will be intercepted and played according to what you specified.

Any request that is not expected