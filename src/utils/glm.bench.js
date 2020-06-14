/* global describe, it */

import * as glm from './glm.js'
import { timeit } from './timeit.js'

describe('glm', () => {
  describe('cross', () => {
    it('works 0', () => {
      const v0 = [2, 3, 5]
      const v1 = [7, 11, 13]

      const run = () => glm.cross(v0, v1)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })
  })

  describe('clone', () => {
    it('works 0 (glm.clone)', () => {
      const v0 = [2, 3, 5]
      const run = () => glm.clone(v0)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })

    it('works 1', () => {
      const v0 = [2, 3, 5]
      const run = () => glm.v3.clone(v0)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })
  })
})