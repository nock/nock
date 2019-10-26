'use strict'

function test(description, specBody) {
  if (specBody.constructor.name === 'AsyncFunction') {
    it(description, async function() {
      await specBody()
    })
  } else {
    it(description, function(done) {
      specBody({ end: done })
    })
  }
}

module.exports = { test }
