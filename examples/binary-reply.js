const http = require('http')
const fs = require('fs')
const path = require('path')

const nock = require('../')

const readFile = function () {
  return fs.readFileSync(
    path.resolve(__dirname, '../tests/assets/reply_file_2.txt.gz')
  )
}

nock('http://binary.com').get('/binary').reply(200, readFile(), {
  'content-type': 'application/octet-stream',
  'content-length': readFile().length,
  'content-disposition': 'attachment; filename=reply_file_2.tar.gz',
})

http.get('http://binary.com/binary', function (res) {
  const data = []
  res.on('data', function (chunk) {
    // try this
    // chunk[0] = 1;
    // chunk[1] = 1;
    data.push(chunk)
  })
  res.on('end', function () {
    const buffer = Buffer.concat(data)
    console.log(
      Buffer.compare(readFile(), buffer) === 0
        ? 'Received the file.'
        : 'Received something else.'
    )
  })
})
