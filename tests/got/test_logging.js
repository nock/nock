'use strict'

const { join } = require('node:path')
const { spawn } = require('node:child_process')
const { expect } = require('chai')

describe('Logging using the `debug` package', () => {
  it('match debugging works', async () => {
    // the log function will have been a few dozen times, there are a few specific to matching we want to validate:

    let resolveTest
    let rejectTest
    const p = new Promise((resolve, reject) => {
      resolveTest = resolve
      rejectTest = reject
    })
    const assertions = [
      /NOCK:BACK \d+: New nock back mode: dryrun/,
      /NOCK:RECORDER \d+: 0 restoring all the overridden http\/https properties/,
      /NOCK:COMMON \d+: restoring requests/,
      /NOCK:INTERCEPT \d+: restoring overridden ClientRequest/,
      /NOCK:INTERCEPT \d+: - ClientRequest was not overridden/,
      /NOCK:COMMON \d+: overriding requests/,
      /NOCK:COMMON \d+: - overriding request for http/,
      /NOCK:COMMON \d+: - overridden request for http/,
      /NOCK:COMMON \d+: - overriding request for https/,
      /NOCK:COMMON \d+: - overridden request for https/,
      /NOCK:INTERCEPT \d+: Overriding ClientRequest/,
      /NOCK:INTERCEPT \d+: ClientRequest overridden/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: reply.headers: {}/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: reply.rawHeaders: \[\]/,
      /NOCK:COMMON \d+: options.hostname in the end: "example.test"/,
      /NOCK:COMMON \d+: options.host in the end: "example.test:80"/,
      /NOCK:INTERCEPT \d+: interceptors for "example.test:80"/,
      /NOCK:INTERCEPT \d+: filtering interceptors for basepath http:\/\/example.test:80/,
      /NOCK:INTERCEPT \d+: matched base path \(1 interceptor\)/,
      /NOCK:COMMON \d+: options.host: example.test:80/,
      /NOCK:COMMON \d+: options.hostname in the end: "example.test"/,
      /NOCK:COMMON \d+: options.host in the end: "example.test:80"/,
      /NOCK:INTERCEPT \d+: interceptors for "example.test:80"/,
      /NOCK:INTERCEPT \d+: filtering interceptors for basepath http:\/\/example.test:80/,
      /NOCK:INTERCEPT \d+: matched base path \(1 interceptor\)/,
      /NOCK:INTERCEPT \d+: using 1 interceptors/,
      /NOCK:REQUEST_OVERRIDER \d+: request write/,
      /NOCK:REQUEST_OVERRIDER \d+: request end/,
      /NOCK:REQUEST_OVERRIDER \d+: ending/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: attempting match {"protocol":"http:","hostname":"example.test","hash":"","search":"","pathname":"\/deep\/link","path":"\/deep\/link","href":"http:\/\/example.test\/deep\/link","method":"POST","retry":{"limit":2,"methods":\["GET","PUT","HEAD","DELETE","OPTIONS","TRACE"\],"statusCodes":\[408,413,429,500,502,503,504,521,522,524\],"errorCodes":\["ETIMEDOUT","ECONNRESET","EADDRINUSE","ECONNREFUSED","EPIPE","ENOTFOUND","ENETUNREACH","EAI_AGAIN"\],"maxRetryAfter":null},"headers":{"user-agent":"got \(https:\/\/github.com\/sindresorhus\/got\)","content-length":"15","accept-encoding":"gzip, deflate, br"},"hooks":{"init":\[\],"beforeRequest":\[\],"beforeRedirect":\[\],"beforeRetry":\[\],"beforeError":\[\],"afterResponse":\[\]},"decompress":true,"throwHttpErrors":true,"followRedirect":true,"isStream":false,"responseType":"text","resolveBodyOnly":false,"maxRedirects":10,"prefixUrl":"","methodRewriting":true,"ignoreInvalidCookies":false,"http2":false,"allowGetBody":false,"pagination":{"countLimit":null,"backoff":0,"requestLimit":10000,"stackAllItems":true},"cacheOptions":{},"url":"http:\/\/example.test\/deep\/link","username":"","password":"","proto":"http","port":80,"host":"example.test:80"}, body = "Hello yourself!"/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: query matching skipped/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: matching http:\/\/example.test:80\/deep\/link to POST http:\/\/example.test:80\/deep\/link: true/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: interceptor identified, starting mocking/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: response.rawHeaders: \[\]/,
      /NOCK:SCOPE:EXAMPLE.TEST \d+: emitting response/,
      /^$/,
    ]

    const child = spawn(
      process.execPath,
      [join(__dirname, './fixtures/logging.mjs')],
      {
        env: {
          NODE_DEBUG: 'nock:*',
        },
      },
    )
    const chunks = []
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      chunks.push(chunk)
    })
    child.stderr.on('end', () => {
      const lines = extractLines(chunks)
      try {
        expect(lines.length).to.be.equal(assertions.length)
        for (let i = 1; i < lines.length; i++) {
          expect(lines[i], `${i}: ${lines[i]}`).to.match(assertions[i])
        }
      } catch (e) {
        rejectTest(e)
        return
      }
      resolveTest()
    })
    await p
  })
})

const removeEscapeColorsRE =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g

function extractLines(chunks) {
  return chunks
    .join('')
    .split('\n')
    .map(v => v.replace(removeEscapeColorsRE, ''))
}
