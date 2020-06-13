/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import { Matrix, MatrixCOO } from './array.js'

describe('array', () => {
  describe('Matrix', () => {
    it('works 0', async () => {
      const a = Matrix.empty([3, 4])
      a.data.set(_.range(3 * 4))
      assert.deepStrictEqual(a.row(1), new Float32Array([4, 5, 6, 7]))
    })
  })

  describe('MatrixCOO', () => {
    it('works 0', async () => {
      const a = MatrixCOO.empty([2, 3], 3)
      assert.deepStrictEqual(a.toDense().data, new Float32Array(6))
      a.set(1, 2, 7)
      a.set(0, 1, 11)
      assert.deepStrictEqual(a.toDense().data, new Float32Array([
        0, 11, 0,
        0, 0, 7
      ]))
      a.set(1, 2, 13)
      assert.deepStrictEqual(a.toDense().data, new Float32Array([
        0, 11, 0,
        0, 0, 7 + 13
      ]))
      assert.throws(() => a.set(0, 0, 1))
    })
  })

  describe('MatrixCSC', () => {
    it('works 0', async () => {
      const a = MatrixCOO.empty([2, 3], 3)
      assert.deepStrictEqual(a.toDense().data, new Float32Array(6))
      a.set(1, 2, 7)
      a.set(0, 1, 11)
      assert.deepStrictEqual(a.toDense().data, new Float32Array([
        0, 11, 0,
        0, 0, 7
      ]))
      a.set(1, 2, 13)
      assert.deepStrictEqual(a.toDense().data, new Float32Array([
        0, 11, 0,
        0, 0, 7 + 13
      ]))
      assert.throws(() => a.set(0, 0, 1))
    })
  })
})
