import assert from 'assert'
import _ from '../../web_modules/lodash.js'

const equal = assert.strictEqual

const deepEqual = assert.deepStrictEqual

const closeTo = (actual, expected, epsilon = 1e-6) => {
  if (Math.abs(actual - expected) < epsilon) { return }
  assert.fail(`\nactual: ${actual}\nexpected: ${expected}\n`)
}

const deepCloseTo = (actual, expected, epsilon = 1e-6) => {
  if (actual.length !== expected.length) {
    assert.fail(`\nactual.length: ${actual.length}\nexpected.length: ${expected.length}\n`)
  }
  actual = _.flattenDeep(actual)
  expected = _.flattenDeep(expected)
  _.zip(actual, expected).forEach(([a, e]) => closeTo(a, e, epsilon))
}

export {
  equal, deepEqual, closeTo, deepCloseTo
}
