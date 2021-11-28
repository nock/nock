const http = require('http')
const https = require('https')

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
    const overriddenRequest = module.request
    const overriddenGet = module.get

    // https://nodejs.org/api/http.html#http_http_request_url_options_callback
    module.request = function (url, options, callback) {
      return newRequest(moduleName, overriddenRequest.bind(module), [
        url,
        options,
        callback,
      ])
    }

    // https://nodejs.org/api/http.html#http_http_get_options_callback
    module.get = function (url, options, callback) {
      const req = newRequest(moduleName, overriddenGet.bind(module), [
        url,
        options,
        callback,
      ])
      req.end()
      return req
    }
  })
}
