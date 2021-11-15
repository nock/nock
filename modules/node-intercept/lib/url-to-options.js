// @ts-check

module.exports = urlToOptions

/**
 * Utility function that converts a URL object into an ordinary
 * options object as expected by the http.request and https.request APIs.
 *
 * This was copied from Node's source
 * https://github.com/nodejs/node/blob/908292cf1f551c614a733d858528ffb13fb3a524/lib/internal/url.js#L1257
 *
 * @param {URL} url
 */
function urlToOptions(url) {
  const options = {
    protocol: url.protocol,
    hostname:
      typeof url.hostname === 'string' && url.hostname.startsWith('[')
        ? url.hostname.slice(1, -1)
        : url.hostname,
    hash: url.hash,
    search: url.search,
    pathname: url.pathname,
    path: `${url.pathname}${url.search || ''}`,
    href: url.href,
  }
  if (url.port !== '') {
    options.port = Number(url.port)
  }
  if (url.username || url.password) {
    options.auth = `${url.username}:${url.password}`
  }
  return options
}
