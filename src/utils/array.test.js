/* global describe, it */

import fs from 'fs'
import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import { Matrix, MatrixCOO, MatrixCSR } from './array.js'
import * as ddg from './ddg.js'
import { readOFF } from './reader.js'
import { hash11 } from './hash.js'
import * as UtilsMisc from './misc.js'

// TODO: make separate utility file
const closeTo = (actual, expected, epsilon = 1e-6) => {
  if (Math.abs(actual - expected) < epsilon) { return }
  assert.fail(`\nactual: ${actual}\nexpected: ${expected}\n`)
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

  describe('MatrixCSR', () => {
    it('works 0', () => {
      const a = MatrixCOO.empty([2, 3], 5)
      a.set(1, 2, 7)
      a.set(0, 1, 11)
      a.set(1, 2, 13)
      a.set(1, 0, 15)

      const b = MatrixCSR.fromCOO(a)
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

    it('works 0 (sortIndices)', () => {
      const a = MatrixCOO.empty([2, 3], 5)
      a.set(0, 1, 11)
      a.set(0, 2, 13)
      a.set(1, 2, 19)
      a.set(1, 0, 17)
      a.set(1, 2, 23)

      const b = MatrixCSR.fromCOO(a)

      assert.deepStrictEqual(b.indptr, new Uint32Array([
        0, 2, 5
      ]))
      assert.deepStrictEqual(b.indices, new Uint32Array([
        2, 1, 2, 0, 2
      ]))
      assert.deepStrictEqual(b.data, new Float32Array([
        13, 11, 23, 17, 19
      ]))
      assert.deepStrictEqual(b.toDense().data, new Float32Array([
        0, 11, 13,
        17, 0, 19 + 23
      ]))

      // Sort indices
      const numDups = b.sortIndices()
      assert.strictEqual(numDups, 1)
      assert.deepStrictEqual(b.indptr, new Uint32Array([
        0, 2, 5
      ]))
      assert.deepStrictEqual(b.indices, new Uint32Array([
        1, 2, 0, 2, 2
      ]))
      assert.deepStrictEqual(b.data, new Float32Array([
        11, 13, 17, 23, 19
      ]))
      assert.deepStrictEqual(b.toDense().data, new Float32Array([
        0, 11, 13,
        17, 0, 23 + 19
      ]))
    })

    it('works 0 (sumDuplicates)', () => {
      const a = MatrixCOO.empty([2, 3], 6)
      a.set(0, 1, 11)
      a.set(0, 2, 13)
      a.set(0, 1, 7)
      a.set(1, 2, 19)
      a.set(1, 0, 17)
      a.set(1, 2, 23)

      const b = MatrixCSR.fromCOO(a)
      b.sumDuplicates()
      assert.deepStrictEqual(b.indptr, new Uint32Array([
        0, 2, 4
      ]))
      assert.deepStrictEqual(b.indices, new Uint32Array([
        1, 2, 0, 2
      ]))
      assert.deepStrictEqual(b.data, new Float32Array([
        18, 13, 17, 42
      ]))
      assert.deepStrictEqual(b.toDense().data, new Float32Array([
        0, 18, 13,
        17, 0, 42
      ]))
    })

    it('works 1', () => {
      const a = MatrixCOO.empty([2, 3], 3)
      a.set(1, 2, 7)
      a.set(0, 1, 11)
      a.set(1, 2, 13)

      const b = MatrixCSR.fromCOO(a)

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

      const b = MatrixCSR.fromDense(a)
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

      const A = MatrixCSR.fromDense(a)
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

      const b = MatrixCSR.fromDense(a)
      b.idsubmuls(2)
      deepCloseTo(b.toDense().data, [
        5, -6, 0, 0,
        2, 11, 0, -8
      ])
    })

    it('works 5 (choleskyCompute) (small)', () => {
      const a = Matrix.empty([3, 3])
      a.data.set([
        4, -1, 0,
        -1, 4, -1,
        0, -1, 4
      ])

      const A = MatrixCSR.fromDense(a)
      A.sumDuplicates()

      const L = A.choleskyCompute()

      const LD = L.toDense()
      const LLT = LD.matmul(LD.transpose())
      deepCloseTo(a.data, LLT.data)

      const L2 = A.choleskyComputeV2()
      deepCloseTo(L2.toDense().data, L.toDense().data)

      const L3 = A.choleskyComputeV3()
      const L3D = L3.toDense().transpose()
      deepCloseTo(L3D.data, L.toDense().data)
    })

    it('works 5 1 (choleskyCompute) (icosphere)', function () {
      this.timeout(10000)
      const { position, index } = UtilsMisc.makeIcosphere(2)
      const verts = Matrix.empty([position.length, 3])
      const f2v = Matrix.empty([index.length, 3], Uint32Array)
      verts.data.set(position.flat())
      f2v.data.set(index.flat())

      let A = ddg.computeLaplacianV2(verts, f2v)
      A = MatrixCSR.fromCOO(A)
      A.sumDuplicates()
      A.negadddiags(1e-3) // -A + h I (make it positive definite)

      const L = A.choleskyCompute()
      const LD = L.toDense()
      L.indices = L.indices.slice(0, L.indptr[verts.shape[0]])

      const L3 = A.choleskyComputeV3()
      const L3D = L3.toDense().transpose()

      deepCloseTo(L3D.data, LD.data)
      deepCloseTo(L3D.matmul(L3D.transpose()).data, A.toDense().data)
    })

    it('works 5 1 (choleskyComputeV3) (bunny laplacian)', function () {
      this.timeout(10000)

      const data = fs.readFileSync('thirdparty/libigl-tutorial-data/bunny.off').toString()
      let { verts, f2v } = readOFF(data, true)
      verts = new Matrix(verts, [verts.length / 3, 3])
      f2v = new Matrix(f2v, [f2v.length / 3, 3])

      let A = ddg.computeLaplacianV2(verts, f2v)
      A = MatrixCSR.fromCOO(A)
      A.sumDuplicates()
      A.negadddiags(1e-3) // -A + h I (make it positive definite)

      const L = A.choleskyComputeV3()

      const b = Matrix.empty([verts.shape[0], 1])
      b.data.set(_.range(b.data.length).map(hash11))

      const x = L.choleskySolveV3(Matrix.emptyLike(b), b)
      const Ax = A.matmul(Matrix.emptyLike(x), x)
      deepCloseTo(Ax.data, b.data, 1e-2)

      // 3485 x 3485
      // A: 24383
      // L: 741586
      // console.log(L.shape[0], A.indptr[A.shape[0]], L.indptr[L.shape[0]])
    })

    it('works 5 1 (choleskyComputeV3) (bunny laplacian pos.def.)', function () {
      this.timeout(10000)

      const data = fs.readFileSync('thirdparty/libigl-tutorial-data/bunny.off').toString()
      let { verts, f2v } = readOFF(data, true)
      const N = verts.length / 3
      verts = new Matrix(verts, [verts.length / 3, 3])
      f2v = new Matrix(f2v, [f2v.length / 3, 3])

      let A = ddg.computeLaplacianV2(verts, f2v)
      A = MatrixCSR.fromCOO(A)
      A.sumDuplicates()
      A.negadddiags(1e-3) // -A + h I (make it positive definite)

      // Crash null space of Laplacian (ImB = KerL^{orth})
      // TODO: I thought this is gonna work ...
      let B = MatrixCOO.empty([N, N - 1], 2 * (N - 1))
      let BT = MatrixCOO.empty([N - 1, N], 2 * (N - 1))
      for (const i of _.range(N - 1)) {
        B.set(i, i, -1)
        B.set(i + 1, i, 1)
        BT.set(i, i, -1)
        BT.set(i, i + 1, 1)
      }
      B = MatrixCSR.fromCOO(B)
      BT = MatrixCSR.fromCOO(BT)
      A = BT.matmulCsr(A).matmulCsr(B)

      // Somehow this is not pos dev any more
      // const L = A.choleskyComputeV3()
    })

    describe('choleskyComputeV4', () => {
      it('works 0', function () {
        const a = Matrix.empty([4, 4])
        a.data.set([
          2, -1, 0, 0,
          -1, 2, -1, 0,
          0, -1, 2, -1,
          0, 0, -1, 2
        ])

        const A = MatrixCSR.fromDense(a)
        const { L, D } = A.choleskyComputeV4() // eslint-disable-line
      })

      it('works 1', function () {
        this.timeout(10000)

        const data = fs.readFileSync('thirdparty/libigl-tutorial-data/bunny.off').toString()
        let { verts, f2v } = readOFF(data, true)
        verts = new Matrix(verts, [verts.length / 3, 3])
        f2v = new Matrix(f2v, [f2v.length / 3, 3])

        let A = ddg.computeLaplacianV2(verts, f2v)
        A = MatrixCSR.fromCOO(A)
        A.sumDuplicates()
        A.negadddiags(1e-3) // -A + h I (make it positive definite)

        // Compute: A = L D L^T
        const { L, D } = A.choleskyComputeV4()

        // RHS b
        const b = Matrix.empty([verts.shape[0], 1])
        b.data.set(_.range(b.data.length).map(hash11))

        // Solve: L D L^T x = b
        const x = Matrix.emptyLike(b)
        L.choleskySolveV4(x, D, b)

        // Verify A x = b
        const Ax = Matrix.emptyLike(b)
        A.matmul(Ax, x)
        deepCloseTo(Ax.data, b.data, 1e-2)
      })
    })

    it('works 5 1 (choleskyCompute) (bunny laplacian)', function () {
      this.timeout(10000)

      const data = fs.readFileSync('thirdparty/libigl-tutorial-data/bunny.off').toString()
      let { verts, f2v } = readOFF(data, true)
      verts = new Matrix(verts, [verts.length / 3, 3])
      f2v = new Matrix(f2v, [f2v.length / 3, 3])

      let A = ddg.computeLaplacianV2(verts, f2v)
      A = MatrixCSR.fromCOO(A)
      A.sumDuplicates()
      A.negadddiags(1e-3) // -A + h I (make it positive definite)

      const L = A.choleskyCompute()
      const nV = verts.shape[0]
      const b = Matrix.empty([nV, 1])
      const x = Matrix.empty([nV, 1])
      b.data.set(_.range(nV).map(hash11))

      L.choleskySolve(x, b)
      const Ax = A.matmul(Matrix.emptyLike(x), x)
      deepCloseTo(Ax.data, b.data, 1e-2)
    })

    it('works 5 (choleskySolve)', () => {
      const a = Matrix.empty([3, 3])
      a.data.set([
        4, -1, 0,
        -1, 4, -1,
        0, -1, 4
      ])

      const A = MatrixCSR.fromDense(a)
      A.sumDuplicates()

      const L = A.choleskyCompute()
      const b = Matrix.empty([3, 1])
      const x = Matrix.emptyLike(b)
      b.data.set([2, 3, 5])

      L.choleskySolve(x, b)

      const Ax = A.matmul(Matrix.emptyLike(x), x)

      deepCloseTo(Ax.data, b.data)
    })

    it('works 6 (matmulT)', () => {
      const a = Matrix.empty([3, 3])
      a.data.set([
        1, 0, 0,
        2, 3, 0,
        4, 5, 6
      ])

      const A = MatrixCSR.fromDense(a)
      const x = Matrix.empty([3, 1])
      x.data.set([2, 3, 5])

      const Ax = A.matmulT(Matrix.emptyLike(x), x)
      deepCloseTo(Ax.data, [
        1 * 2 + 2 * 3 + 4 * 5,
        3 * 3 + 5 * 5,
        6 * 5
      ])
    })

    it('works 6 (matmulCsr)', () => {
      let A = Matrix.empty([3, 3])
      A.data.set([
        1, 0, 2,
        0, 3, 4,
        5, 6, 0
      ])

      let B = Matrix.empty([3, 3])
      B.data.set([
        1, 0, 5,
        0, 3, 6,
        2, 4, 0
      ])

      A = MatrixCSR.fromDense(A)
      B = MatrixCSR.fromDense(B)
      const C = A.matmulCsr(B)

      deepCloseTo(C.toDense().data, [
        [5, 8, 5],
        [8, 25, 18],
        [5, 18, 61]
      ])
    })

    describe('conjugateGradient', () => {
      it('works 0', () => {
        const a = Matrix.empty([4, 4])
        a.data.set([
          2, -1, 0, 0,
          -1, 2, -1, 0,
          0, -1, 2, -1,
          0, 0, -1, 2
        ])

        const A = MatrixCSR.fromDense(a)
        const x = Matrix.empty([4, 1])
        const b = Matrix.emptyLike(x)
        b.data.set([1, 2, 3, 4])

        const { residue } = A.conjugateGradient(x, b)
        closeTo(residue, 0)
        deepCloseTo(x.data, [4, 7, 8, 6])
      })

      it('works 1', () => {
        const data = fs.readFileSync('thirdparty/libigl-tutorial-data/bunny.off').toString()
        let { verts, f2v } = readOFF(data, true)
        verts = new Matrix(verts, [verts.length / 3, 3])
        f2v = new Matrix(f2v, [f2v.length / 3, 3])

        let { laplacian, kg } = ddg.computeMoreV2(verts, f2v)
        laplacian = MatrixCSR.fromCOO(laplacian)
        laplacian.sumDuplicates()

        // cf. Poisson problem from `VectorFieldSolver`
        const Lneg = laplacian.clone().negadddiags(1e-3) // = - L + h I (positive definite)
        const b = Matrix.emptyLike(kg)
        b.data[0] = 1
        b.data[11] = 1
        b.muleqs(2 * Math.PI).subeq(kg)
        const bneg = b.clone().muleqs(-1)

        const u = Matrix.emptyLike(b)
        const { iteration, residue } = Lneg.conjugateGradient(u, bneg)
        closeTo(iteration, 188)
        assert(residue < 1e-3)

        const Lnegu = Matrix.emptyLike(u)
        Lneg.matmul(Lnegu, u)
        deepCloseTo(Lnegu.data, bneg.data, 1e-2)
      })
    })
  })
})
