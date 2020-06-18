/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import * as glm from './glm.js'
import _ from '../../web_modules/lodash.js'

const deepEqual = assert.deepStrictEqual
const closeTo = (actual, expected, epsilon = 1e-6) => {
  if (Math.abs(actual - expected) < epsilon) { return }
  assert.fail(`\nactual: ${actual}\nexpected: ${expected}\n`)
}
const deepCloseTo = (actual, expected, epsilon = 1e-6) => {
  if (actual.length !== expected.length) {
    assert.fail(`\nactual: ${actual}\nexpected: ${expected}\n`)
  }
  actual = _.flattenDeep(actual)
  expected = _.flattenDeep(expected)
  _.zip(actual, expected).forEach(([a, e]) => closeTo(a, e, epsilon))
}

describe('glm', () => {
  describe('vec3', () => {
    it('works 0', () => {
      const { subeq } = glm.vec3
      const v0 = [7, 11, 13]
      const v1 = [2, 3, 5]

      deepEqual(subeq(v0, v1), [5, 8, 8])
      deepEqual(v0, [5, 8, 8])
    })

    it('works 1', () => {
      const { matmuleq } = glm.vec3
      const v = [2, 3, 5]
      const m = [
        1, 2, 3,
        10, 20, 30,
        100, 200, 300
      ]
      deepEqual(matmuleq(m, v), [532, 1064, 1596])
      deepEqual(v, [532, 1064, 1596])
    })
  })

  describe('mat3', () => {
    it('works 0', () => {
      const { PI } = Math
      const { axisAngle } = glm.mat3

      deepCloseTo(axisAngle([1, 0, 0], 0.5 * PI), [
        1, 0, 0,
        0, 0, 1,
        0, -1, 0
      ])
      deepCloseTo(axisAngle([0, 1, 0], 0.5 * PI), [
        0, 0, -1,
        0, 1, 0,
        1, 0, 0
      ])
      deepCloseTo(axisAngle([0, 0, 1], 0.5 * PI), [
        0, 1, 0,
        -1, 0, 0,
        0, 0, 1
      ])
    })
  })
})
