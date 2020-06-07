/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import * as glm from './glm.js'

/* eslint-disable no-unused-vars */
const {
  vec2, vec3, vec4, /* mat2, mat3, mat4, */
  add, sub, mul, div, /* mmul */
  dot, cross, length, normalize,
  /* inverse, transpose, */
  pow2, dot2 /* diag, outer, outer2, */
} = glm
const equal = assert.strictEqual
const deepEqual = assert.deepStrictEqual
/* eslint-enable no-unused-vars */

describe('glm', () => {
  it('works 0', () => {
    const v0 = vec3(2, 3, 5)
    const v1 = vec3(7, 11, 13)
    const s0 = v0[0]
    const s1 = v1[0]

    deepEqual(add(v0, v1), [9, 14, 18])
    deepEqual(add(v0, s1), [9, 10, 12])
    deepEqual(add(s0, v1), [9, 13, 15])
  })
})
