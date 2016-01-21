var nock    = require('../.');
var request = require('request');
var test    = require('tap').test;
var http    = require('http');

test('query with array', function(t) {
    var query1 = { list: [123, 456, 789], a: 'b' };

    request({
        url: 'https://array-query-string.com/test',
        qs: query1,
        method: 'GET'
    }, function(error, response, body) {
        t.ok(!error);
        t.deepEqual(body, 'success');
        t.end();
    });

    nock('https://array-query-string.com')
        .get('/test')
        .query(query1)
        .reply(200, 'success');
});

test('query with array which contains unencoded value ', function(t) {
    var query1 = { list: ['hello%20world', '2hello%20world', 3], a: 'b' };

    nock('https://array-query-string.com')
        .get('/test')
        .query(query1)
        .reply(200, 'success');

    request({
        url: 'https://array-query-string.com/test',
        qs: query1,
        method: 'GET'
    }, function(error, response, body) {
        t.ok(!error);
        t.deepEqual(body, 'success');
        t.end();
    });
});

test('query with array which contains pre-encoded values ', function(t) {
    var query1 = { list: ['hello%20world', '2hello%20world']};

    nock('https://array-query-string.com', { encodedQueryParams: true })
        .get('/test')
        .query(query1)
        .reply(200, 'success');

    request({
        url: 'https://array-query-string.com/test?list%5B0%5D=hello%20world&list%5B1%5D=2hello%20world',
        method: 'GET'
    }, function(error, response, body) {
        t.ok(!error);
        t.deepEqual(body, 'success');
        t.end();
    });
});

test('query with object', function(t) {
    var query1 = {
        a: {
            b: ['c', 'd']
        },
        e: [1, 2, 3, 4]
    };

    nock('https://object-query-string.com')
        .get('/test')
        .query(query1)
        .reply(200, 'success');

    request({
        url: 'https://object-query-string.com/test',
        qs: query1,
        method: 'GET'
    }, function(error, response, body) {
        t.ok(!error);
        t.deepEqual(body, 'success');
        t.end();
    });
});

test('query with object which contains unencoded value', function(t) {
    var query1 = {
        a: {
            b: 'hello%20world'
        }
    };

    nock('https://object-query-string.com')
        .get('/test')
        .query(query1)
        .reply(200, 'success');

    request({
        url: 'https://object-query-string.com/test',
        qs: query1,
        method: 'GET'
    }, function(error, response, body) {
        t.ok(!error);
        t.deepEqual(body, 'success');
        t.end();
    });
});

test('query with object which contains pre-encoded values', function(t) {
    var query1 = {
        a: {
            b: 'hello%20world'
        }
    };

    nock('https://object-query-string.com',  { encodedQueryParams: true })
        .get('/test')
        .query(query1)
        .reply(200, 'success');

    request({
        url: 'https://object-query-string.com/test?a%5Bb%5D=hello%20world',
        method: 'GET'
    }, function(error, response, body) {
        t.ok(!error);
        t.deepEqual(body, 'success');
        t.end();
    });
});

test('query with array and regexp', function(t) {
    var expectQuery = {
        list: [123, 456, 789],
        foo: /.*/,
        a: 'b'
    };

    var actualQuery = {
        list: [123, 456, 789],
        foo: 'bar',
        a: 'b'
    };

    nock('https://array-query-string.com')
        .get('/test')
        .query(expectQuery)
        .reply(200, 'success');

    request({
        url: 'https://array-query-string.com/test',
        qs: actualQuery,
        method: 'GET'
    }, function(error, response, body) {
        t.ok(!error);
        t.deepEqual(body, 'success');
        t.end();
    });
});
