'use strict'

const undici = require('undici')
const handleRequest = require('../handle-request')
const { URL } = require('node:url')
const { convertHeadersToRaw } = require('../common')

class NockClient extends undici.Client {
  dispatch(options, handler) {
    const url = new URL(options.origin + options.path)
    if (options.query) {
      url.search = new URLSearchParams(options.query).toString()
    }

    const decompressedRequest = new Request(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    })

    handleRequest(decompressedRequest).then(async response => {
      if (response) {
        handler.onConnect?.(err => handler.onError(err), null)
        handler.onHeaders?.(
          response.status,
          convertHeadersToRaw(response.headers),
          () => {},
          response.statusText,
        )
        handler.onData?.(Buffer.from(await response.arrayBuffer()))
        handler.onComplete?.([]) // responseTrailers
      } else {
        const dispatcher = options.dispatcher || {
          dispatch: super.dispatch.bind(this),
        }
        dispatcher.dispatch(options, handler)
      }
    })
  }
}

class NockAgent extends undici.Dispatcher {
  constructor(options) {
    super(options)

    this.agent = new undici.Agent({ options, factory: this.factory.bind(this) })
    this.originalOptions = options
  }

  dispatch(options, handler) {
    this.agent.dispatch(options, handler)
  }

  factory(origin) {
    const mockOptions = { ...this.originalOptions, agent: this }
    return new NockClient(origin, mockOptions)
  }
}

function activate() {
  undici.setGlobalDispatcher(new NockAgent())
}

function deactivate() {
  undici.setGlobalDispatcher(new undici.Agent())
}

module.exports = {
  activate,
  deactivate,
}
