# Upgrading to Nock 15

[Release Tag](https://github.com/nock/nock/releases/tag/v15.0.0)

The goal of this release is to create more predictable, modern and consistent API.

## Breaking Changes

1. **`no match` event now sends a `Request` object**  
   Previously, the `no match` event had two different signatures. Now, it consistently sends a `Request` object.

   ```js
   // Before
   nock.emitter.on('no match', (req, options, body) => {
     console.log(req.path, options, body)
   })
   nock.emitter.on('no match', (req) => {
     console.log(req.path, options, body)
   })

   // After
   nock.emitter.on('no match', (request: Request) => {
     console.log(request.url)
   })
   ```

2. **`reply` now receives a `Request` object**  
   The `interceptor` no longer contains the `req` property. Use the `Request` object passed to the `reply`.

   ```js
   // Before
   .reply((uri, body) => {
     console.log(this.req.path)
     return 'response'
   })

   // After
   .reply(async (request) => {
     console.log(await request.text())
     return 'response'
   })
   ```

3. **`reply` header functions now only receive the `Request` instance**  
   The `reply` header functions no longer receive the `request`, `response`, and (response) `body` parameters. Instead, they now only receive the `Request` instance.

   ```js
   // Before
   .reply(200, 'Hello World!', {
      'Content-Length': (req, res, body) => body.length,
      ETag: () => `${Date.now()}`,
    })

   // After
   .reply(200, 'Hello World!', {
      'Body-Content-Length': async (request) => (await request.text()).length,
      ETag: () => `${Date.now()}`,
    })
   ```

4. **`request` and `replied` events now send a `Request` object**  
   Events now emits the `Request` object instead of attaching the request to the `interceptor`. This ensures a consistent API and avoids reliance on internal properties.

   ```js
   // Before
   nock.emitter.on('replied', (req, interceptor) => {
     console.log(req.path, interceptor.statusCode)
   })

   // After
   nock.emitter.on('replied', (request: Request, interceptor) => {
     console.log(request.url, interceptor.statusCode)
   })
   ```

5. **New `getDecompressedGetBody` Function**  
   A new utility function, `getDecompressedGetBody`, has been introduced to handle the edge case of `GET` requests with a body. This function allows you to retrieve the decompressed body of a `GET` request, which is not natively supported by the `Request` object.

   ```js
   const scope = nock('http://example.test')
     .get('/')
     .reply(200, request => text(getDecompressedGetBody(request)))
   ```

6. **Removed `delayBody` and `delayConnection` methods**  
   These methods have been consolidated into a single `delay` method that accepts a single argument and behave as `delayBody`.

   ```js
   // Before
   .delayBody(200)
   .delayConnection(100)
   .delay({ head: 200, body: 300 })

   // After
   .delay(200) // actual waits 200ms
   ```

7. **Body matcher functions now only receive the body**  
   The body matcher functions no longer receive the `Request` object.

   ```js
   // Before
   .post('/', (body, req) => body.includes('test'))

   // After
   .post('/', (body) => body.includes('test'))
   ```

8. **Removed `this.req` in reply functions**  
   The `this.req` property is no longer available. Use the `Request` object passed to the `replyFunction`.

   ```js
   // Before
   .reply(function (uri, body) {
     console.log(this.req.headers)
     return 'response'
   })

   // After
   .reply((request) => {
     console.log(Object.fromEntries(request.headers.entries()))
     return 'response'
   })
   ```

9. **Updated `Host` header behavior**  
   We no longer ignore the `Host` header if it is not explicitly defined in the request and match it like any other header.

   ```js
   const scope = nock('http://example.test', {
     reqheaders: { host: 'some.other.domain.test' },
   })
     .get('/')
     .reply()

   const { statusCode } = await got('http://example.test/') // Nock no match
   ```

10. **Scope constructor no longer supports legacy URL format**  
   The `Scope` constructor no longer supports the legacy URL format. Use the modern URL format instead.

   ```js
   // Before
   const scope = nock(url.parse('http://example.test'))

   // After
   const scope = nock('http://example.test')
   const scope = nock(new URL('http://example.test'))
   ```

---

For more details, refer to the [release notes](https://github.com/nock/nock/releases/tag/v15.0.0).
