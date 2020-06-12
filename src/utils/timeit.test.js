/* global describe, it */

import assert from 'assert' // eslint-disable-line
import * as timeit from './timeit.js'

describe('timeit', () => {
  it.skip('works 0', async () => {
    const setup = `
      const xs = new Array(10000)
    `
    const stmt = `
      for (let i = 0; i < xs.length; i++) {
        xs[i] = i.toString()
      }
    `
    // On my machine
    // 128.73 usec (stddev: 1.308, min: 126.8, max: 130.3, n: 800)
    console.log(timeit.timeit(stmt, setup).resultString)

    // Compared to python
    // $ python -m timeit -n 800 '[str(n) for n in range(10000)]'
    // 800 loops, best of 5: 2.1 msec per loop
  })
})
