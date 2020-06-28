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
    it('works 0', () => {
      const { verts, f2v } = misc2.makeTriangle(12)
      const handles = [{ vertex: 0, target: [0, 0, 0] }]
      const solver = new Example01()

      console.log(`nV: ${verts.shape[0]}, nF: ${f2v.shape[0]}`)
      {
        const run = () => solver.init(verts, f2v, handles)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('Example01.init')
        console.log(resultString)
      }

      {
        const run = () => solver.update()
        const { resultString } = timeit('args.run()', '', '', { run }, 5)
        console.log('Example01.update')
        console.log(resultString)
      }
    })

    it('works 1', () => {
      const n = 20
      const { position, index } = misc2.makePlane(n, n, false, false, true, false)
      const { verts, f2v } = misc2.toMatrices(position, index)
      const handles = [{ vertex: 0, target: [0, 0, 0] }]
      const solver = new Example01()

      console.log(`nV: ${verts.shape[0]}, nF: ${f2v.shape[0]}`)
      {
        const run = () => solver.init(verts, f2v, handles)
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('Example01.init')
        console.log(resultString)
      }

      {
        const run = () => solver.update()
        const { resultString } = timeit('args.run()', '', '', { run }, 5)
        console.log('Example01.update')
        console.log(resultString)
      }
    })
  })
})
