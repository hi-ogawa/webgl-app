/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import { NdArray, Matrix } from './array.js'

describe('array', () => {
  describe('Matrix', () => {
    it('works 0', async () => {
      const A = Matrix.empty([3, 4], Float32Array)
      A.data.set(_.range(3 * 4))

      const v = A.pick(1)
      assert.deepStrictEqual(_.range(4).map(i => v.get(0, i)), [4, 5, 6, 7])
    })
  })

  describe('NdArray', () => {
    it('works 0', async () => {
      const A = NdArray.empty([3, 4], Float32Array)
      A.data.set(_.range(3 * 4))
    })
  })
})
