'use strict'

const { expect } = require('chai')
const stringify = require('../lib/stringify')

describe('stringify', () => {
  it('should stringify a number', () => {
    expect(stringify(42)).to.equal('42')
  })

  it('should stringify a string', () => {
    expect(stringify('foo')).to.equal('"foo"')
  })

  it('should stringify a boolean', () => {
    expect(stringify(true)).to.equal('true')
  })

  it('should stringify null', () => {
    expect(stringify(null)).to.equal('null')
  })

  it('should stringify an object', () => {
    expect(stringify({ foo: 'bar' })).to.equal('{"foo":"bar"}')
  })

  it('should stringify an array', () => {
    expect(stringify([1, 2, 3])).to.equal('[1,2,3]')
  })

  it('should handle a circular reference in an object', () => {
    const obj = { foo: 'bar' }
    obj.self = obj
    expect(stringify(obj)).to.equal('{"foo":"bar","self":"[Circular ~]"}')
  })

  it('should handle a circular reference in an array', () => {
    const arr = [1, 2, 3]
    arr.push(arr)
    expect(stringify(arr)).to.equal('[1,2,3,"[Circular ~]"]')
  })

  it('should handle a nested circular reference', () => {
    const obj = { name: 'parent' }
    obj.child = { name: 'child', parent: obj }
    expect(stringify(obj)).to.equal(
      '{"name":"parent","child":{"name":"child","parent":"[Circular ~]"}}',
    )
  })

  it('should handle a deeply nested circular reference with path notation', () => {
    const obj = { level1: { level2: { level3: {} } } }
    obj.level1.level2.level3.self = obj.level1
    expect(stringify(obj)).to.equal(
      '{"level1":{"level2":{"level3":{"self":"[Circular ~.level1]"}}}}',
    )
  })

  it('should handle multiple references to the same object', () => {
    const shared = { value: 'shared' }
    const obj = { a: shared, b: shared }
    expect(stringify(obj)).to.equal(
      '{"a":{"value":"shared"},"b":{"value":"shared"}}',
    )
  })

  it('should handle an object with a toJSON method that returns a circular reference', () => {
    const obj = {
      name: 'circular',
      toJSON() {
        return this
      },
    }
    expect(stringify(obj)).to.equal('{"name":"circular"}')
  })

  it('should handle an object with circular references in different properties', () => {
    const obj = { a: {}, b: {} }
    obj.a.self = obj.a
    obj.b.self = obj.b
    expect(stringify(obj)).to.equal(
      '{"a":{"self":"[Circular ~.a]"},"b":{"self":"[Circular ~.b]"}}',
    )
  })

  it('should handle a circular reference inside a nested array', () => {
    const arr = [1, [2, 3]]
    arr[1].push(arr)
    expect(stringify(arr)).to.equal('[1,[2,3,"[Circular ~]"]]')
  })
})
