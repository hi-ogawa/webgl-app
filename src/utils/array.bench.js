/* global describe, it */

import fs from 'fs'
import _ from '../../web_modules/lodash.js' // eslint-disable-line
import { Matrix, MatrixCSR, NdArray } from './array.js'
import * as ddg from './ddg.js'
import { readOFF } from './reader.js'
import { timeit } from './timeit.js'
import { hash11 } from './hash.js'
import wasmEx01 from '../../misc/wasm/ex01.js'

describe('array', () => {
  describe('Matrix', () => {
    it('works 0', async () => {
      const A = new Float32Array(512 * 512)
      const run = () => {
        let x = 0
        for (let i = 0; i < 512; i++) {
          for (let j = 0; j < 512; j++) {
            x += A[512 * i + j]
          }
        }
        return x
      }
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })

    it('works 1', async () => {
      const A = Matrix.empty([512, 512], Float32Array)
      const run = () => {
        let x = 0
        for (let i = 0; i < A.shape[0]; i++) {
          for (let j = 0; j < A.shape[1]; j++) {
            x += A.get(i, j)
          }
        }
        return x
      }
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })

    it('works 2', async () => {
      const A = NdArray.empty([512, 512], Float32Array)
      const run = () => {
        let x = 0
        for (let i = 0; i < A.shape[0]; i++) {
          for (let j = 0; j < A.shape[1]; j++) {
            x += A.get(i, j)
          }
        }
        return x
      }
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })
  })

  describe('Array (built-in)', () => {
    it('works 1', async () => {
      const run = () => {
        const a = []
        for (let i = 0; i < 128; i++) {
          a.push(i)
        }
      }
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })

    it('works 2', async () => {
      const run = () => {
        const a = []
        for (let i = 0; i < 128; i++) {
          a[i] = i
        }
      }
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })

    it('works 3', async () => {
      const run = () => {
        const a = []
        for (let i = 0; i < 128; i++) {
          a[a.length] = i
        }
      }
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })
  })

  describe('MatrixCSR', () => {
    describe('gaussSeidel', () => {
      it('works 0', () => {
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
        const run = () => Lneg.gaussSeidel(u, bneg, 32)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('MatrixCSR.gaussSeidel')
        console.log(resultString)
      })

      // Wasm is about twice faster when -O3
      it('works 1', async () => {
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

        // Copy to wasm
        try {
          const ww = await wasmEx01.instantiate()
          const wwA = new ww.MatrixCSR(...Lneg.shape, Lneg.nnz())
          wwA.indptr().set(Lneg.indptr)
          wwA.indices().set(Lneg.indices)
          wwA.data().set(Lneg.data)

          const wwx = new ww.Matrix(...b.shape)
          const wwb = new ww.Matrix(...b.shape)
          wwb.data().set(bneg.data)

          const run = () => ww.MatrixCSR.gaussSeidel(wwA, wwx, wwb, 32)
          const { resultString } = timeit('args.run()', '', '', { run })
          console.log('MatrixCSR.gaussSeidel (wasm)')
          console.log(resultString)
        } catch (e) {
          console.log('MatrixCSR.gaussSeidel (wasm) -- wasm not found --')
        }
      })
    })

    describe('misc', () => {
      it('works 0', () => {
        const data = fs.readFileSync('thirdparty/libigl-tutorial-data/bunny.off').toString()
        let { verts, f2v } = readOFF(data, true)
        let Lcoo, Lcsr, A, AL
        verts = new Matrix(verts, [verts.length / 3, 3])
        f2v = new Matrix(f2v, [f2v.length / 3, 3])

        {
          const run = () => { Lcoo = ddg.computeLaplacianV2(verts, f2v) }
          const { resultString } = timeit('args.run()', '', '', { run })
          console.log('computeLaplacianV2')
          console.log(resultString)
        }

        {
          const run = () => { Lcsr = MatrixCSR.fromCOO(Lcoo) }
          const { resultString } = timeit('args.run()', '', '', { run })
          console.log('MatrixCSR.fromCOO')
          console.log(resultString)
        }

        {
          const run = () => { Lcsr.sumDuplicates() }
          const { resultString } = timeit('args.run()', '', '', { run })
          console.log('MatrixCSR.sumDuplicates')
          console.log(resultString)
        }

        {
          const hn2 = Matrix.emptyLike(verts)
          const run = () => { Lcsr.matmul(hn2, verts) }
          const { resultString } = timeit('args.run()', '', '', { run })
          console.log('MatrixCSR.matmul')
          console.log(resultString)
        }

        {
          A = Lcsr.clone()
          A.negadddiags(1e-3) // -A + h I (make it positive definite)
          // A.idsubmuls(1) // I - h A (make it positive definite)
          const run = () => { AL = A.choleskyComputeV3() }
          const { resultString } = timeit('args.run()', '', '', { run }, 1, 4)
          console.log('MatrixCSR.choleskyCompute')
          console.log(resultString)
        }

        {
          const nV = verts.shape[0]
          const b = Matrix.empty([nV, 1])
          const x = Matrix.empty([nV, 1])
          b.data.set(_.range(nV).map(hash11))
          const run = () => { AL.choleskySolveV3(x, b) }
          const { resultString } = timeit('args.run()', '', '', { run })
          console.log('MatrixCSR.choleskySolve')
          console.log(resultString)
        }
      })
    })
  })
})
