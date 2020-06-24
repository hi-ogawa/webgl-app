/* global describe, it */

import _ from '../../web_modules/lodash.js'
import * as glm from './glm.js'
import { timeit } from './timeit.js'
import { hash11 } from './hash.js'

describe('glm', () => {
  describe('cross', () => {
    it('works 0', () => {
      const v0 = [2, 3, 5]
      const v1 = [7, 11, 13]

      const run = () => glm.vec3.cross(v0, v1)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })
  })

  describe('clone', () => {
    it('works 1', () => {
      const v0 = [2, 3, 5]
      const run = () => glm.vec3.clone(v0)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })
  })

  describe('misc', () => {
    it('works 1', () => {
      const { mat3 } = glm
      const { matmul, transpose } = mat3

      {
        const A = [1, 2, 3, 4]
        const run = () => glm.mat2.svdInvertible(A)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('mat2.svdInvertible')
        console.log(resultString)
      }

      {
        const B = _.range(3 * 3).map(i => hash11(i ^ 0x259c))
        const A = matmul(transpose(B), B)
        const run = () => mat3.eigenPSD(A)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('mat3.eigenPSD')
        console.log(resultString)
      }

      {
        const B = _.range(3 * 3).map(i => hash11(i ^ 0x259c))
        const A = matmul(transpose(B), B)
        const run = () => mat3.svdInvertible(A)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('mat3.svdInvertible')
        console.log(resultString)
      }

      {
        const B1 = [
          ..._.range(3 * 2).map(i => hash11(i ^ 0x259c)),
          0, 0, 0
        ]
        const B2 = transpose([
          ..._.range(3 * 2).map(i => hash11(i ^ 0x36ad)),
          0, 0, 0
        ])
        const A = matmul(B1, B2)
        const run = () => mat3.svdNonInvertible(A)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('mat3.svdNonInvertible')
        console.log(resultString)
      }
    })
  })
})
