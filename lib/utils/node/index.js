'use strict'
const { Readable } = require('node:stream')

const kGetRequestBody = Symbol('kGetRequestBody')

/**
 * @param {Request} request
 * @returns {Readable}
 * Returns the request body stream of the given request.
 * @note This is only relevant in the context of `http.ClientRequest`.
 * This function will throw if the given `request` wasn't created based on
 * the `http.ClientRequest` instance.
 * You must rely on the web stream consumers for other request clients.
 */
function getGetRequestBody(request) {
  if (request.method !== 'GET') {
    throw new Error('The request method must be GET')
  }
  return Readable.from(Reflect.get(request, kGetRequestBody))
}

/**
 * @param {Request} request
 * @param {ArrayBuffer} body
 */
function setGetRequestBody(request, body) {
  Reflect.set(request, kGetRequestBody, Buffer.from(body))
}

module.exports = {
  getGetRequestBody,
  setGetRequestBody,
}
