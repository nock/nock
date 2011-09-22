# Nock

HTTP Server mocking for Node.js

Nock can be used to test modules that perform HTTP requests in isolation.

For instance, if a module performs HTTP requests to a CouchDB server or makes HTTP requests to the Amazon API, you can test that module in isolation.

## Install

    $ npm install nock

## Use

On your test, you can do this:

    var nock = require('nock');

    couchdb = mokk('http://myapp.iriscouch.com')
                .get('/users/1')
                .reply