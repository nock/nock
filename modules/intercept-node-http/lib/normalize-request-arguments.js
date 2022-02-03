// @ts-check

const url = require('url')

const urlToOptions = require('./url-to-options')
const { headersFieldNamesToLowerCase } = require('./utils')

module.exports = normalizeNodeRequestArguments

/**
 * Converts the arguments from the various signatures of http[s].request into a standard
 * options object and an optional callback function.
 *
 * https://nodejs.org/api/http.html#http_http_request_url_options_callback
 *
 * Taken from the beginning of the native `ClientRequest`.
 * https://github.com/nodejs/node/blob/908292cf1f551c614a733d858528ffb13fb3a524/lib/_http_client.js#L68
 */
function normalizeNodeRequestArguments(input, options, cb) {
  if (!input) {
    throw new Error(
      'Making a request with empty `options` is not supported in Nock'
    )
  }

  if (typeof input === 'string') {
    input = urlToOptions(new url.URL(input))
  } else if (input instanceof url.URL) {
    input = urlToOptions(input)
  } else {
    cb = options
    options = input
    input = null
  }

  if (typeof options === 'function') {
    cb = options
    options = input || {}
  } else {
    options = Object.assign(input || {}, options)
  }

  // We use lower-case header field names throughout Nock.
  options.headers = headersFieldNamesToLowerCase(options.headers || {})

  return { options, callback: cb }
}
