import { expect } from 'chai'
import assertRejects from 'assert-rejects'
import net from 'node:net'
import sinon from 'sinon'
import nock from '../../index.ts'

import got from './got_client.js'
import * as servers from '../servers/index.js'

describe('`disableNetConnect()`', () => {
  it('prevents connection to unmocked hosts', async () => {
    nock.disableNetConnect()

    nock('http://www.example.test').get('/').reply(200)

    await assertRejects(
      got('https://other.example.test/'),
      /Nock: Disallowed net connect for "other.example.test:443\/"/,
    )
  })

  it('prevents connections when no hosts are mocked', async () => {
    nock.disableNetConnect()

    await assertRejects(got('http://example.test'), err => {
      expect(err).to.include({
        code: 'ENETUNREACH',
        message: 'Nock: Disallowed net connect for "example.test:80/"',
      })
      expect(err.stack).to.be.a('string')
      return true
    })
  })
})

describe('`enableNetConnect()`', () => {
  it('enables real HTTP request only for specified domain, via string', async () => {
    const onResponse = sinon.spy()
    const { origin } = await servers.startHttpServer((request, response) => {
      onResponse()
      response.writeHead(200)
      response.end()
    })

    nock.enableNetConnect('localhost')

    await got(origin)
    expect(onResponse).to.have.been.calledOnce()
  })

  it('disallows request for other domains, via string', async () => {
    nock.enableNetConnect('localhost')

    await assertRejects(
      got('https://example.test/'),
      /Nock: Disallowed net connect for "example.test:443\/"/,
    )
  })

  it('enables real HTTP request only for specified domain, via regexp', async () => {
    const onResponse = sinon.spy()
    const { origin } = await servers.startHttpServer((request, response) => {
      onResponse()
      response.writeHead(200)
      response.end()
    })

    nock.enableNetConnect(/ocalhos/)

    await got(origin)
    expect(onResponse).to.have.been.calledOnce()
  })

  it('disallows request for other domains, via regexp', async () => {
    nock.enableNetConnect(/ocalhos/)

    await assertRejects(
      got('https://example.test/'),
      /Nock: Disallowed net connect for "example.test:443\/"/,
    )
  })

  it('enables real HTTP request only for specified domain, via function', async () => {
    const onResponse = sinon.spy()
    const { origin } = await servers.startHttpServer((request, response) => {
      onResponse()
      response.writeHead(200)
      response.end()
    })

    nock.enableNetConnect(host => host.includes('ocalhos'))

    await got(origin)
    expect(onResponse).to.have.been.calledOnce()
  })

  it('disallows request for other domains, via function', async () => {
    nock.enableNetConnect(host => host.includes('ocalhos'))

    await assertRejects(
      got('https://example.test/'),
      /Nock: Disallowed net connect for "example.test:443\/"/,
    )
  })

  it('passes the domain to be tested, via function', async () => {
    const matcher = sinon.stub().returns(false)
    nock.enableNetConnect(matcher)

    await got('https://example.test/').catch(() => undefined) // ignore rejection, expected

    expect(matcher).to.have.been.calledOnceWithExactly('example.test:443')
  })

  it('passes a non-http socket through when the server writes first', async () => {
    const serverDataListener = sinon.spy()
    const server = net.createServer(connection => {
      connection.write('PING')
      connection.on('data', chunk => {
        serverDataListener(chunk.toString())
        connection.write('PONG')
      })
    })

    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })

    const { port, address } = server.address()
    const messages = []

    try {
      await new Promise((resolve, reject) => {
        const socket = net.connect(port, address)

        socket.on('data', chunk => {
          messages.push(chunk.toString())

          if (messages.length === 1) {
            socket.write('hello')
            return
          }

          resolve()
          socket.destroy()
        })

        socket.on('error', reject)
      })

      expect(messages).to.deep.equal(['PING', 'PONG'])
      expect(serverDataListener).to.have.been.calledOnceWithExactly('hello')
    } finally {
      await new Promise((resolve, reject) => {
        server.close(err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
  })
})
