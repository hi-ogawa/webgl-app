/* global describe, it */

import { Example00, Example01 } from './physics.js'
import { timeit } from './timeit.js'
import * as misc2 from './misc2.js'

describe('physics', () => {
  describe('Example00', () => {
    it('works', () => {
      const solver = new Example00()
      solver.init()
      const run = () => solver.update()
      const { resultString } = timeit('args.run()', '', '', { run }, 8)
      console.log(resultString)
    })
  })

  describe('Example01', () => {
    it('works', () => {
      const { verts, f2v } = misc2.makeTriangle(6)
      const handles = [{ vertex: 0, target: [0, 0, 0] }]
      const solver = new Example01()
      solver.init(verts, f2v, handles)

      // TODO: Where's the bottleneck? (projection via SVD or global conjugate gradient solve)
      const run = () => solver.update()
      const { resultString } = timeit('args.run()', '', '', { run }, 8)
      console.log(resultString)
    })
  })
})
