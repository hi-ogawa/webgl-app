/* global describe, it */

import { timeit } from './timeit.js'
import * as misc2 from './misc2.js'

describe('misc2', () => {
  describe('sort3', () => {
    // TODO: It seems these are not really reliable
    it('works', () => {
      {
        const run = () => misc2.sort3(0, 1, 2)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('sort3')
        console.log(resultString)
      }
      {
        const run = () => misc2.sortParity3(0, 1, 2)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('sortParity3')
        console.log(resultString)
      }
      {
        const a = [0, 1, 2]
        const run = () => misc2._sortParity3(a)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('_sortParity3')
        console.log(resultString)
      }
      {
        const run = () => [0, 1, 2].sort()
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('Array.sort')
        console.log(resultString)
      }
    })
  })

  describe('binom', () => {
    it('works', () => {
      const run = () => misc2.binom(64, 4) // ~ 2 ** 6 ** 4 = 2 ** 24
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log('binom(64, 4)')
      console.log(resultString)
    })
  })
})
