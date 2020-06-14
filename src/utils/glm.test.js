/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import * as glm from './glm.js'

const deepEqual = assert.deepStrictEqual

describe('glm', () => {
  it('works 0', () => {
    const { add, vec3 } = glm
    const v0 = vec3(2, 3, 5)
    const v1 = vec3(7, 11, 13)
    const s0 = v0[0]
    const s1 = v1[0]

    deepEqual(add(v0, v1), [9, 14, 18])
    deepEqual(add(v0, s1), [9, 10, 12])
    deepEqual(add(s0, v1), [9, 13, 15])
  })

  describe('v3', () => {
    it('works 0', () => {
      const { subeq } = glm.v3
      const v0 = [7, 11, 13]
      const v1 = [2, 3, 5]

      deepEqual(subeq(v0, v1), [5, 8, 8])
      deepEqual(v0, [5, 8, 8])
    })
  })
})
