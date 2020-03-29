'use strict'

const assertRejects = require('assert-rejects')
const { expect } = require('chai')
const mikealRequest = require('request')
const { test } = require('tap')
const nock = require('../')
const got = require('./got_client')

require('./cleanup_after_each')()
require('./setup')

test('match json body regardless of key ordering', async () => {
  const scope = nock('http://example.test')
    .post('/', { foo: 'bar', bar: 'foo' })
    .reply(200, 'Heyyyy!')

  const { body } = await got.post('http://example.test/', {
    body: JSON.stringify({ bar: 'foo', foo: 'bar' }),
  })

  expect(body).to.equal('Heyyyy!')
  scope.done()
})

test('match form body regardless of field ordering', async () => {
  const scope = nock('http://example.test')
    .post('/', { foo: 'bar', bar: 'foo' })
    .reply(200, 'Heyyyy!')

  const { body } = await got.post('http://example.test/', {
    form: { bar: 'foo', foo: 'bar' },
  })

  expect(body).to.equal('Heyyyy!')
  scope.done()
})

test('match json body specified as json string', async () => {
  const scope = nock('http://example.test')
    .post('/', JSON.stringify({ bar: 'foo', foo: 'bar' }))
    .reply(200, 'Heyyyy!')

  const { body } = await got.post('http://example.test/', {
    body: JSON.stringify({ bar: 'foo', foo: 'bar' }),
  })

  expect(body).to.equal('Heyyyy!')
  scope.done()
})

test('match body is regex trying to match string (matches)', async () => {
  const scope = nock('http://example.test')
    .post('/', new RegExp('abc'))
    .reply(201)

  const { statusCode } = await got.post('http://example.test/', {
    body: JSON.stringify({ nested: { value: 'abc' } }),
  })

  expect(statusCode).to.equal(201)
  scope.done()
})

test('match body is regex trying to match string (does not match)', async () => {
  const scope1 = nock('http://example.test')
    .post('/', new RegExp('def'))
    .reply(201)
  const scope2 = nock('http://example.test')
    .post('/', new RegExp('.'))
    .reply(202)

  const { statusCode } = await got.post('http://example.test/', {
    body: JSON.stringify({ nested: { value: 'abc' } }),
  })

  expect(statusCode).to.equal(202)
  expect(scope1.isDone()).to.be.false()
  scope2.done()
})

test('match body with regex', t => {
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
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test('match body (with space character) with regex', t => {
  nock('http://example.test').post('/', /a bc/).reply(200)

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
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test('match body with regex inside array', t => {
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
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test('match body with empty object inside', t => {
  nock('http://example.test').post('/', { obj: {} }).reply(200)

  mikealRequest(
    {
      url: 'http://example.test/',
      method: 'post',
      json: {
        obj: {},
      },
    },
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test('match body with nested object inside', t => {
  nock('http://example.test').post('/', /x/).reply(200)

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
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test("doesn't match body with mismatching keys", async () => {
  nock('http://example.test').post('/', { a: 'a' }).reply(200)

  const request = got.post('http://example.test', { json: { a: 'a', b: 'b' } })
  await assertRejects(request, /Nock: No match for request/)
})

// https://github.com/nock/nock/issues/1713
test("doesn't match body with same number of keys but different keys", async () => {
  nock('http://example.test').post('/', { a: {} }).reply()

  const request = got.post('http://example.test', { json: { b: 123 } })
  await assertRejects(request, /Nock: No match for request/)
})

test('match body with form multipart', t => {
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
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
  const form = r.form()
  form._boundary = 'fixboundary' // fix boundary so that request could match at all
  form.append('field', 'value')
})

test('array like urlencoded form posts are correctly parsed', async () => {
  const scope = nock('http://example.test')
    .post('/', {
      arrayLike: [
        {
          fieldA: '0',
          fieldB: 'data',
          fieldC: 'value',
        },
      ],
    })
    .reply()

  const { statusCode } = await got.post('http://example.test', {
    form: {
      'arrayLike[0].fieldA': '0',
      'arrayLike[0].fieldB': 'data',
      'arrayLike[0].fieldC': 'value',
    },
  })

  expect(statusCode).to.equal(200)
  scope.done()
})

// This test pokes at an inherent shortcoming of URL encoded form data. "technically" form data values
// can ONLY be strings. However, years of HTML abuse have lead to non-standard ways of handling more complex data.
// https://url.spec.whatwg.org/#urlencoded-serializing
// > The application/x-www-form-urlencoded format is in many ways an aberrant monstrosity...
// Mikeal's Request uses `querystring` by default, optionally `qs` or `form-data`. Got uses `URLSearchParams`.
// All of which handle "arrays" as values differently.
// Nock uses `querystring`, as the consensus seems to be that it's the most widely used and intuitive, but it means
// this test would fail if converted to Got.
test('urlencoded form posts are matched with non-string values', t => {
  nock('http://example.test')
    .post('/', {
      boolean: true,
      number: 1,
      values: [false, -1, 'test'],
    })
    .reply()

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
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test('urlencoded form posts are matched with regexp', async () => {
  const scope = nock('http://example.test')
    .post('/', {
      regexp: /^xyz$/,
    })
    .reply()

  const { statusCode } = await got.post('http://example.test', {
    form: {
      regexp: 'xyz',
    },
  })

  expect(statusCode).to.equal(200)
  scope.done()
})

test('match utf-8 buffer body with utf-8 buffer', t => {
  nock('http://example.test').post('/', Buffer.from('hello')).reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      encoding: null,
      body: Buffer.from('hello'),
    },
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test("doesn't match utf-8 buffer body with mismatching utf-8 buffer", t => {
  nock('http://example.test').post('/', Buffer.from('goodbye')).reply(200)

  mikealRequest(
    {
      url: 'http://example.test',
      method: 'post',
      encoding: null,
      body: Buffer.from('hello'),
    },
    function (err) {
      expect(err).to.be.an('Error')
      t.end()
    }
  )
})

test('match binary buffer body with binary buffer', t => {
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
    function (err, res) {
      if (err) throw err
      expect(res.statusCode).to.equal(200)
      t.end()
    }
  )
})

test("doesn't match binary buffer body with mismatching binary buffer", t => {
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
    function (err) {
      expect(err).to.be.an('Error')
      t.end()
    }
  )
})

// for the next two tests, keeping the same urls causes them to interfere with another.

test("doesn't match binary buffer body with mismatching utf-8 buffer", t => {
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
    function (err) {
      expect(err).to.be.an('Error')
      t.end()
    }
  )
})

test("doesn't match utf-8 buffer body with mismatching binary buffer", t => {
  nock('http://example-2.test').post('/', Buffer.from('hello')).reply(200)

  mikealRequest(
    {
      url: 'http://example-2.test',
      method: 'post',
      encoding: null,
      body: Buffer.from([0xff, 0xff, 0xff]),
    },
    function (err) {
      expect(err).to.be.an('Error')
      t.end()
    }
  )
})
