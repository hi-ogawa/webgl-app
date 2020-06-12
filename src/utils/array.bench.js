/* global describe, it */

import _ from '../../web_modules/lodash.js' // eslint-disable-line
import { Matrix, NdArray } from './array.js'
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
})
