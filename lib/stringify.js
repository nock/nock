'use strict'
/**
 * @see https://github.com/moll/json-stringify-safe/blob/02cfafd45f06d076ac4bf0dd28be6738a07a72f9/stringify.js
 * @license
 * The ISC License
 *
 * Copyright (c) Isaac Z. Schlueter and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
 * IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/**
 * @param {*} obj
 * @returns {string}
 */
function stringify(obj) {
  return JSON.stringify(obj, safeReplacer())
}

/**
 * @param {Array<*>} stack
 * @param {Array<string>} keys
 * @param {*} value
 * @returns {string}
 */
function cycleReplacer(stack, keys, value) {
  if (stack[0] === value) return '[Circular ~]'
  return `[Circular ~.${keys.slice(0, stack.indexOf(value)).join('.')}]`
}

/**
 * @param {Array<*>} [stack]
 * @param {Array<string>} [keys]
 * @returns {(key: string, value: *) => *} */
function safeReplacer(stack = [], keys = []) {
  return function (key, value) {
    if (stack.length > 0) {
      const thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) {
        value = cycleReplacer(stack, keys, value)
      }
    } else {
      stack.push(value)
    }

    return value
  }
}

module.exports = stringify
