/* global describe, it */

import fs from 'fs'
import _ from '../../web_modules/lodash.js' // eslint-disable-line
import { Matrix, MatrixCSC, NdArray } from './array.js'
import * as ddg from './ddg.js'
import { readOFF } from './reader.js'
import { timeit } from './timeit.js'

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

  describe('MatrixCSC', () => {
    it('works', () => {
      const data = fs.readFileSync('thirdparty/libigl-tutorial-data/bunny.off').toString()
      let { verts, f2v } = readOFF(data, true)
      let L

      verts = new Matrix(verts, [verts.length / 3, 3])
      f2v = new Matrix(f2v, [f2v.length / 3, 3])
      const hn2 = Matrix.empty(verts.shape)

      {
        const run = () => { L = ddg.computeLaplacianV2(verts, f2v) }
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('computeLaplacianV2')
        console.log(resultString)
      }

      {
        const run = () => { L = MatrixCSC.fromCOO(L) }
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('MatrixCSC.fromCOO')
        console.log(resultString)
      }

      {
        const run = () => { L.sumDuplicates() }
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('MatrixCSC.sumDuplicates')
        console.log(resultString)
      }

      {
        const run = () => { L.matmul(hn2, verts) }
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('MatrixCSC.matmul')
        console.log(resultString)
      }
    })
  })
})
