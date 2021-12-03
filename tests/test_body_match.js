'use strict'

const assertRejects = require('assert-rejects')
const { expect } = require('chai')
const FormData = require('form-data')
const nock = require('../')
const got = require('./got_client')

describe('`matchBody()`', () => {
  it('match json body regardless of key ordering', async () => {
    const scope = nock('http://example.test')
      .post('/', { foo: 'bar', bar: 'foo' })
      .reply(200, 'Heyyyy!')

    const { body } = await got.post('http://example.test/', {
      json: { bar: 'foo', foo: 'bar' },
    })

    expect(body).to.equal('Heyyyy!')
    scope.done()
  })

  it('match form body regardless of field ordering', async () => {
    const scope = nock('http://example.test')
      .post('/', { foo: 'bar', bar: 'foo' })
      .reply(200, 'Heyyyy!')

    const { body } = await got.post('http://example.test/', {
      form: { bar: 'foo', foo: 'bar' },
    })

    expect(body).to.equal('Heyyyy!')
    scope.done()
  })

  it('match json body specified as json string', async () => {
    const scope = nock('http://example.test')
      .post('/', JSON.stringify({ bar: 'foo', foo: 'bar' }))
      .reply(200, 'Heyyyy!')

    const { body } = await got.post('http://example.test/', {
      json: { bar: 'foo', foo: 'bar' },
    })

    expect(body).to.equal('Heyyyy!')
    scope.done()
  })

  it('match body is regex trying to match string (matches)', async () => {
    const scope = nock('http://example.test').post('/', /abc/).reply(201)

    const { statusCode } = await got.post('http://example.test/', {
      json: { nested: { value: 'abc' } },
    })

    expect(statusCode).to.equal(201)
    scope.done()
  })

  it('match body is regex trying to match string (does not match)', async () => {
    const scope1 = nock('http://example.test').post('/', /def/).reply(201)
    const scope2 = nock('http://example.test').post('/', /./).reply(202)

    const { statusCode } = await got.post('http://example.test/', {
      json: { nested: { value: 'abc' } },
    })

    expect(statusCode).to.equal(202)
    expect(scope1.isDone()).to.be.false()
    scope2.done()
  })

  it('match body with regex', async () => {
    const scope = nock('http://example.test')
      .post('/', { auth: { passwd: /a.+/ } })
      .reply(200)

    const { statusCode } = await got.post('http://example.test', {
      json: { auth: { passwd: 'abc' } },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('match body (with space character) with regex', async () => {
    const scope = nock('http://example.test').post('/', /a bc/).reply(200)

    const { statusCode } = await got.post('http://example.test', {
      json: { auth: { passwd: 'a bc' } },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('match body with regex inside array', async () => {
    const scope = nock('http://example.test')
      .post('/', { items: [{ name: /t.+/ }] })
      .reply(200)

    const { statusCode } = await got.post('http://example.test', {
      json: { items: [{ name: 'test' }] },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('match body with empty object inside', async () => {
    const scope = nock('http://example.test').post('/', { obj: {} }).reply(200)

    const { statusCode } = await got.post('http://example.test', {
      json: { obj: {} },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('match body with nested object inside', async () => {
    const scope = nock('http://example.test').post('/', /x/).reply(200)

    const { statusCode } = await got.post('http://example.test', {
      json: { obj: { x: 1 } },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it("doesn't match body with mismatching keys", async () => {
    nock('http://example.test').post('/', { a: 'a' }).reply(200)

    const request = got.post('http://example.test', {
      json: { a: 'a', b: 'b' },
    })
    await assertRejects(request, /Nock: No match for request/)
  })

  // https://github.com/nock/nock/issues/1713
  it("doesn't match body with same number of keys but different keys", async () => {
    nock('http://example.test').post('/', { a: {} }).reply()

    const request = got.post('http://example.test', { json: { b: 123 } })
    await assertRejects(request, /Nock: No match for request/)
  })

  it('match body with form multipart', async () => {
    const form = new FormData()
    const boundary = form.getBoundary()
    form.append('field', 'value')

    const scope = nock('http://example.test')
      .post(
        '/',
        `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}--\r\n`
      )
      .reply(200)

    const { statusCode } = await got.post('http://example.test', { body: form })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('array like urlencoded form posts are correctly parsed', async () => {
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
  // this test only passes with Got if the array is stringified.
  it('urlencoded form posts are matched with non-string values', async () => {
    const scope = nock('http://example.test')
      .post('/', {
        boolean: true,
        number: 1,
        values: 'false,-1,test',
      })
      .reply()

    const { statusCode } = await got.post('http://example.test', {
      // "body": "boolean=true&number=1&values=false%2C-1%2Ctest"
      form: {
        boolean: true,
        number: 1,
        values: [false, -1, 'test'],
      },
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it('urlencoded form posts are matched with regexp', async () => {
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

  it('match utf-8 buffer body with utf-8 buffer', async () => {
    const scope = nock('http://example.test')
      .post('/', Buffer.from('hello'))
      .reply(200)

    const { statusCode } = await got.post('http://example.test', {
      body: Buffer.from('hello'),
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it("doesn't match utf-8 buffer body with mismatching utf-8 buffer", async () => {
    nock('http://example.test').post('/', Buffer.from('goodbye')).reply(200)

    const request = got.post('http://example.test', {
      body: Buffer.from('hello'),
    })

    await assertRejects(request, /Nock: No match for request/)
  })

  it('match binary buffer body with binary buffer', async () => {
    const scope = nock('http://example.test')
      .post('/', Buffer.from([0xff, 0xff, 0xff]))
      .reply(200)

    const { statusCode } = await got.post('http://example.test', {
      body: Buffer.from([0xff, 0xff, 0xff]),
    })

    expect(statusCode).to.equal(200)
    scope.done()
  })

  it("doesn't match binary buffer body with mismatching binary buffer", async () => {
    nock('http://example.test')
      .post('/', Buffer.from([0xff, 0xff, 0xfa]))
      .reply(200)

    const request = got.post('http://example.test', {
      body: Buffer.from([0xff, 0xff, 0xff]),
    })

    await assertRejects(request, /Nock: No match for request/)
  })

  it("doesn't match binary buffer body with mismatching utf-8 buffer", async () => {
    nock('http://example.test')
      .post('/', Buffer.from([0xff, 0xff, 0xff]))
      .reply(200)

    const request = got.post('http://example.test', {
      body: Buffer.from('hello'),
    })

    await assertRejects(request, /Nock: No match for request/)
  })

  it("doesn't match utf-8 buffer body with mismatching binary buffer", async () => {
    nock('http://example.test').post('/', Buffer.from('hello')).reply(200)

    const request = got.post('http://example.test', {
      body: Buffer.from([0xff, 0xff, 0xff]),
    })

    await assertRejects(request, /Nock: No match for request/)
  })
})
