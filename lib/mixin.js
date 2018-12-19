'use strict'
const _ = require('lodash')

function mixin(a, b) {
  a = _.cloneDeep(a)
  for (const prop in b) {
    a[prop] = b[prop]
  }
  return a
}

module.exports = mixin
