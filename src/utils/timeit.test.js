/* global describe, it */

import assert from 'assert' // eslint-disable-line
import * as timeit from './timeit.js'

describe('timeit', () => {
  it.skip('works 0', async () => {
    const setup = `
      const xs = new Float32Array(2**14).fill(1)
      let result = 0
    `
    const stmt = `
      for (let i = 0; i < xs.length; i++) {
        result += xs[i]
      }
    `
    // Check if `result` is realy there
    const teardown = `
      console.log(result)
    `

    // On my machine
    // 27.113 usec (stddev: 0.3188, min: 26.73, max: 27.57, n: 4000)
    console.log(timeit.timeit(stmt, setup, teardown).resultString)

    // Compared to python/numpy
    // $ python -m timeit -s 'import numpy as np; xs = np.ones(2**14, dtype=np.float32)' 'xs.sum()'
    // 50000 loops, best of 5: 9.76 usec per loop
  })
})
