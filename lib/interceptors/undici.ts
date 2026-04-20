// This file is loaded lazily after confirming undici is installed
// eslint-disable-next-line n/no-unpublished-import
import undici from 'undici'
import handleRequest from '../handle-request.ts'
import { URL } from 'node:url'
import { convertHeadersToRaw } from '../common.ts'

class NockClient extends undici.Client {
  constructor(origin: any, options?: any) {
    super(origin, options)
  }

  dispatch(options: any, handler: any) {
    const url = new URL(options.path, options.origin)
    if (options.query) {
      url.search = new URLSearchParams(options.query).toString()
    }

    const decompressedRequest = new Request(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      duplex: options.body ? 'half' : undefined,
    })

    handleRequest(decompressedRequest)
      .then(async (response: Response | undefined) => {
        if (response) {
          handler.onConnect?.((err: Error) => handler.onError(err), null)
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
      .catch((err: Error) => {
        handler.onError?.(err)
      })
    return true
  }
}

class NockAgent extends undici.Dispatcher {
  declare agent: any
  declare originalOptions: any

  constructor(options?: any) {
    super()

    this.agent = new undici.Agent({ factory: (this.factory.bind(this)) as any })
    this.originalOptions = options
  }

  dispatch(options: any, handler: any) {
    return this.agent.dispatch(options, handler)
  }

  factory(origin: string | URL) {
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

export {
  activate,
  deactivate,
}
