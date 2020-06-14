/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import { Matrix, MatrixCOO, MatrixCSC } from './array.js'

const closeTo = (actual, expected, epsilon = 1e-6) => {
  if (epsilon < Math.abs(actual - expected)) {
    assert.fail(`\nactual: ${actual}\nexpected: ${expected}\n`)
  }
}
const deepCloseTo = (actual, expected, epsilon = 1e-6) => {
  actual = _.flattenDeep(actual)
  expected = _.flattenDeep(expected)
  _.zip(actual, expected).forEach(([a, e]) => closeTo(a, e, epsilon))
}

describe('array', () => {
  describe('Matrix', () => {
    it('works 0', () => {
      const a = Matrix.empty([3, 4])
      a.data.set(_.range(3 * 4))
      assert.deepStrictEqual(a.row(1), new Float32Array([4, 5, 6, 7]))
    })

    it('works 1', () => {
      const a = Matrix.empty([3, 4])
      a.data.set(_.range(3 * 4))
      assert.strictEqual(a.dotHS2(), _.sum(_.range(3 * 4).map(x => x ** 2)))
    })
  })

  describe('MatrixCOO', () => {
    it('works 0', () => {
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

    it('works 1', () => {
      const a = MatrixCOO.empty([2, 3], 3)
      a.set(1, 2, 7)
      a.set(0, 1, 11)
      a.set(1, 2, 13)

      const x = Matrix.empty([3, 1])
      x.data.set([2, 3, 5])

      const y = Matrix.empty([2, 1])
      a.matmul(y, x)
      assert.deepStrictEqual(y.data, new Float32Array([
        3 * 11,
        5 * (7 + 13)
      ]))
    })
  })

  describe('MatrixCSC', () => {
    it('works 0', () => {
      const a = MatrixCOO.empty([2, 3], 5)
      a.set(1, 2, 7)
      a.set(0, 1, 11)
      a.set(1, 2, 13)
      a.set(1, 0, 15)

      const b = MatrixCSC.fromCOO(a)
      assert.deepStrictEqual(b.indptr, new Uint32Array([
        0, 1, 4
      ]))

      // Duplicate is not added together yet
      assert.deepStrictEqual(b.indices, new Uint32Array([
        1, 0, 2, 2
      ]))
      assert.deepStrictEqual(b.data, new Float32Array([
        11, 15, 13, 7
      ]))

      assert.deepStrictEqual(b.toDense().data, new Float32Array([
        0, 11, 0,
        15, 0, 7 + 13
      ]))
    })

    it('works 1', () => {
      const a = MatrixCOO.empty([2, 3], 3)
      a.set(1, 2, 7)
      a.set(0, 1, 11)
      a.set(1, 2, 13)

      const b = MatrixCSC.fromCOO(a)

      const x = Matrix.empty([3, 1])
      x.data.set([2, 3, 5])

      const y = Matrix.empty([2, 1])
      b.matmul(y, x)
      assert.deepStrictEqual(y.data, new Float32Array([
        3 * 11,
        5 * (7 + 13)
      ]))
    })

    it('works 2', () => {
      const a = Matrix.empty([2, 4])
      a.data.set([
        2, 3, 0, 0,
        -1, 2, 0, 4
      ])

      const b = MatrixCSC.fromDense(a)
      assert.deepStrictEqual(b.indptr, new Uint32Array([
        0, 2, 5
      ]))
      assert.deepStrictEqual(b.indices, new Uint32Array([
        0, 1, 0, 1, 3
      ]))
      assert.deepStrictEqual(b.data, new Float32Array([
        2, 3, -1, 2, 4
      ]))
    })

    it('works 3', () => {
      // Irreduciby diagonally dominant matrix (thus Gauss-Seidel converges)
      const a = Matrix.empty([4, 4])
      a.data.set([
        2, -1, 0, 0,
        -1, 2, -1, 0,
        0, -1, 2, -1,
        0, 0, -1, 2
      ])

      const A = MatrixCSC.fromDense(a)
      const x = Matrix.empty([4, 1])
      const b = x.clone()
      b.data.set([1, 2, 3, 4])

      _.range(16).forEach(() => {
        A.stepGaussSeidel(x, b)
      })

      const Ax = Matrix.empty([4, 1])
      A.matmul(Ax, x)

      deepCloseTo(Ax.data, b.data, 1e-2)
    })

    it('works 4', () => {
      const a = Matrix.empty([2, 4])
      a.data.set([
        -2, 3, 0, 0,
        -1, -5, 0, 4
      ])

      const b = MatrixCSC.fromDense(a)
      b.idsubmuls(2)
      deepCloseTo(b.toDense().data, [
        5, -6, 0, 0,
        2, 11, 0, -8
      ])
    })
  })
})
