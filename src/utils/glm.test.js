/* global describe, it */

import * as glm from './glm.js'
import { hash11 } from './hash.js'
import { deepEqual, deepCloseTo } from './test-misc.js'

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
    describe('axisAngle', () => {
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

    describe('inverse', () => {
      it('works 0', () => {
        const { inverse, matmul } = glm.mat3
        const a = [
          2, 0, 0,
          0, 3, 0,
          0, 0, 5
        ]
        deepCloseTo(inverse(a), [
          1 / 2, 0, 0,
          0, 1 / 3, 0,
          0, 0, 1 / 5
        ])
        deepCloseTo(matmul(a, inverse(a)), [
          1, 0, 0,
          0, 1, 0,
          0, 0, 1
        ])
      })

      it('works 0', () => {
        const { normalize, cross } = glm.vec3
        const { inverse, transpose } = glm.mat3
        const x = normalize([hash11(0x13), hash11(0x57), hash11(0x9b)])
        const y = normalize(cross(x, [hash11(0x31), hash11(0x75), hash11(0xb9)]))
        const z = cross(x, y)
        const a = [...x, ...y, ...z] // Unitary
        deepCloseTo(inverse(a), transpose(a))
      })
    })
  })
})
