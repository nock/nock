const http = require('http')
const https = require('https')

const normalizeNodeRequestArguments = require('./normalize-request-arguments')

module.exports = overrideRequests

/**
 * Overrides the current `request` function of `http` and `https` modules with
 * our own version which intercepts issues HTTP/HTTPS requests and forwards them
 * to the given `newRequest` function.
 *
 * @param  {Function} newRequest - a function handling requests; it accepts four arguments:
 *   - moduleName - a string with the overridden module's protocol name (either `http` or `https`)
 *   - overriddenRequest - the overridden module's request function already bound to module's object
 *   - options - the options of the issued request
 *   - callback - the callback of the issued request
 */
function overrideRequests(newRequest) {
  ;['http', 'https'].forEach(function (moduleName) {
    const module = moduleName === 'http' ? http : https

    // https://nodejs.org/api/http.html#http_http_request_url_options_callback
    module.request = function nockInterceptedRequest(...args) {
      const { options, callback } = normalizeNodeRequestArguments(...args)
      return newRequest(withDefaultProtocol(moduleName, options), callback)
    }

    // https://nodejs.org/api/http.html#http_http_get_options_callback
    module.get = function nockInterceptedGet(...args) {
      const { options, callback } = normalizeNodeRequestArguments(...args)
      const req = newRequest(withDefaultProtocol(moduleName, options), callback)
      req.end()
      return req
    }
  })
}

function withDefaultProtocol(moduleName, options) {
  return {
    protocol: `${moduleName}:`,
    ...options,
  }
}
