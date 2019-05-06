'use strict'

const nock = require('../')
const { test } = require('tap')
const mikealRequest = require('request')
const assert = require('assert')

require('./cleanup_after_each')()

test('allow unordered body with json encoding', t => {
  const scope = nock('http://example.test')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo',
    })
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://example.test/like-wtf',
      method: 'POST',
      json: {
        bar: 'foo',
        foo: 'bar',
      },
    },
    function(e, r, body) {
      t.equal(body, 'Heyyyy!')
      scope.done()
      t.end()
    }
  )
})

test('allow unordered body with form encoding', { only: true }, t => {
  const scope = nock('http://example.test')
    .post('/like-wtf', {
      foo: 'bar',
      bar: 'foo',
    })
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://example.test/like-wtf',
      method: 'POST',
      form: {
        bar: 'foo',
        foo: 'bar',
      },
    },
    function(e, r, body) {
      t.equal(body, 'Heyyyy!')
      scope.done()
      t.end()
    }
  )
})

test('allow string json spec', t => {
  const bodyObject = { bar: 'foo', foo: 'bar' }

  const scope = nock('http://example.test')
    .post('/like-wtf', JSON.stringify(bodyObject))
    .reply(200, 'Heyyyy!')

  mikealRequest(
    {
      uri: 'http://example.test/like-wtf',
      method: 'POST',
      json: {
        bar: 'foo',
        foo: 'bar',
      },
    },
    function(e, r, body) {
      t.equal(body, 'Heyyyy!')
      scope.done()
      t.end()
    }
  )
})

test('match body is regex trying to match string', function(t) {
  nock('http://example.test')
    .post('/', new RegExp('a.+'))
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test/',
      method: 'post',
      json: {
        auth: {
          passwd: 'abc',
        },
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('match body with regex', function(t) {
  nock('http://example.test')
    .post('/', { auth: { passwd: /a.+/ } })
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      json: {
        auth: {
          passwd: 'abc',
        },
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('match body (with space character) with regex', function(t) {
  nock('http://example.test')
    .post('/', /a bc/)
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      json: {
        auth: {
          passwd: 'a bc',
        },
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('match body with regex inside array', function(t) {
  nock('http://example.test')
    .post('/', { items: [{ name: /t.+/ }] })
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test/',
      method: 'post',
      json: {
        items: [
          {
            name: 'test',
          },
        ],
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('match body with empty object inside', function(t) {
  nock('http://example.test')
    .post('/', { obj: {} })
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test/',
      method: 'post',
      json: {
        obj: {},
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('match body with nested object inside', function(t) {
  nock('http://example.test')
    .post('/', /x/)
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      json: {
        obj: {
          x: 1,
        },
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test("doesn't match body with mismatching keys", function(t) {
  nock('http://example.test')
    .post('/', { a: 'a' })
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      json: {
        a: 'a',
        b: 'b',
      },
    },
    function(err) {
      assert.ok(err)
      t.end()
    }
  )
})

test('match body with form multipart', function(t) {
  nock('http://example.test')
    .post(
      '/',
      '--fixboundary\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--fixboundary--\r\n'
    )
    .reply(200)

  const r = mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
  const form = r.form()
  form._boundary = 'fixboundary' // fix boundary so that request could match at all
  form.append('field', 'value')
})

test('array like urlencoded form posts are correctly parsed', function(t) {
  nock('http://example.test')
    .post('/', {
      arrayLike: [
        {
          fieldA: '0',
          fieldB: 'data',
          fieldC: 'value',
        },
      ],
    })
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      form: {
        'arrayLike[0].fieldA': '0',
        'arrayLike[0].fieldB': 'data',
        'arrayLike[0].fieldC': 'value',
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('urlencoded form posts are matched with non-string values', function(t) {
  nock('http://example.test')
    .post('/', {
      boolean: true,
      number: 1,
      values: [false, -1, 'test'],
    })
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      form: {
        boolean: true,
        number: 1,
        values: [false, -1, 'test'],
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('urlencoded form posts are matched with regexp', function(t) {
  nock('http://example.test')
    .post('/', {
      regexp: /^xyz$/,
    })
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      form: {
        regexp: 'xyz',
      },
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test('match utf-8 buffer body with utf-8 buffer', function(t) {
  nock('http://example.test')
    .post('/', Buffer.from('hello'))
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      encoding: null,
      body: Buffer.from('hello'),
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test("doesn't match utf-8 buffer body with mismatching utf-8 buffer", function(t) {
  nock('http://example.test')
    .post('/', Buffer.from('goodbye'))
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      encoding: null,
      body: Buffer.from('hello'),
    },
    function(err) {
      assert.ok(err)
      t.end()
    }
  )
})

test('match binary buffer body with binary buffer', function(t) {
  nock('http://example.test')
    .post('/', Buffer.from([0xff, 0xff, 0xff]))
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      encoding: null,
      body: Buffer.from([0xff, 0xff, 0xff]),
    },
    function(err, res) {
      if (err) throw err
      assert.equal(res.statusCode, 200)
      t.end()
    }
  )
})

test("doesn't match binary buffer body with mismatching binary buffer", function(t) {
  nock('http://example.test')
    .post('/', Buffer.from([0xff, 0xff, 0xfa]))
    .reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      encoding: null,
      body: Buffer.from([0xff, 0xff, 0xff]),
    },
    function(err) {
      assert.ok(err)
      t.end()
    }
  )
})

// for the next two tests, keeping the same urls causes them to interfere with another.

test("doesn't match binary buffer body with mismatching utf-8 buffer", function(t) {
  nock('http://example-1.test')
    .post('/', Buffer.from([0xff, 0xff, 0xff]))
    .reply(200)

  mikealRequest(
    {
      url: 'http://example-1.test',
      method: 'post',
      encoding: null,
      body: Buffer.from('hello'),
    },
    function(err) {
      assert.ok(err)
      t.end()
    }
  )
})

test("doesn't match utf-8 buffer body with mismatching binary buffer", function(t) {
  nock('http://example-2.test')
    .post('/', Buffer.from('hello'))
    .reply(200)

  mikealRequest(
    {
      url: 'http://example-2.test',
      method: 'post',
      encoding: null,
      body: Buffer.from([0xff, 0xff, 0xff]),
    },
    function(err) {
      assert.ok(err)
      t.end()
    }
  )
})
