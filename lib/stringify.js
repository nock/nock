'use strict'
// Vendored from: https://github.com/moll/json-stringify-safe/blob/master/stringify.js
// Original commit: 02cfafd45f06d076ac4bf0dd28be6738a07a72f9
// Date vendored: 2025-09-25
// License: ISC
// Modifications: Formatting/lints

exports = module.exports = stringify
exports.getSerialize = serializer

function stringify(obj, replacer, spaces, cycleReplacer) {
  return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
}

function serializer(replacer, cycleReplacer) {
  const stack = []
  const keys = []

  if (cycleReplacer == null)
    cycleReplacer = function (key, value) {
      if (stack[0] === value) return '[Circular ~]'
      return `[Circular ~.${keys.slice(0, stack.indexOf(value)).join('.')}]`
    }

  return function (key, value) {
    if (stack.length > 0) {
      const thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
    } else stack.push(value)

    return replacer == null ? value : replacer.call(this, key, value)
  }
}
