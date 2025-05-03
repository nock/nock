const { Readable } = require("node:stream")

const kDecompressedGetBody = Symbol('kDecompressedGetBody')

/**
 * @param {Request} request
 * @returns {ArrayBuffer}
 * Returns the request body stream of the given request.
 * @note This is only relevant in the context of `http.ClientRequest`.
 * This function will throw if the given `request` wasn't created based on
 * the `http.ClientRequest` instance.
 * You must rely on the web stream consumers for other request clients.
 */
function getDecompressedGetBody(request) {
  if (request.method !== 'GET') {
    throw new Error('The request method must be GET')
  }
  return Readable.from(Reflect.get(request, kDecompressedGetBody))
}

/**
 * @param {Request} request 
 * @param {ArrayBuffer} body 
 */
function setDecompressedGetBody(request, body) {
  Reflect.set(request, kDecompressedGetBody, Buffer.from(body))
}

module.exports = {
  getDecompressedGetBody,
  setDecompressedGetBody,
}