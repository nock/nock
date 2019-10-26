'use strict'

function test(description, specBody) {
  if (specBody.constructor.name === 'AsyncFunction') {
    it(description, async () => specBody())
  } else {
    it(description, done => {
      specBody({ end: done })
    })
  }
}

module.exports = { test }
