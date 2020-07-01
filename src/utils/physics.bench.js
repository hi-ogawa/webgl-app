/* global describe, it */

import * as physics from './physics.js'
import { timeit } from './timeit.js'
import * as misc2 from './misc2.js'

describe('physics', () => {
  describe('Example00', () => {
    it('works', () => {
      const solver = new physics.Example00()
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
      const solver = new physics.Example01()

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
      const n = 16
      const { position, index } = misc2.makePlane(n, n)
      const { verts, f2v } = misc2.toMatrices(position, index)
      const handles = [{ vertex: 0, target: [0, 0, 0] }]
      const solver = new physics.Example01()

      console.log(`nV: ${verts.shape[0]}, nF: ${f2v.shape[0]}`)
      {
        const run = () => solver.init(verts, f2v, handles)
        const { resultString } = timeit('args.run()', '', '', { run }, 1, 1)
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

  describe('Example02', () => {
    it('works 0', () => {
      const n = 6
      const { verts, c3xc0 } = misc2.makeTetrahedralizedCubeSymmetric(n / 2)
      const handles = [{ vertex: 0, target: [0, 0, 0] }]
      const solver = new physics.Example02()

      console.log(`nC0: ${verts.shape[0]}, nC3: ${c3xc0.shape[0]}`)
      {
        const run = () => solver.init(verts, c3xc0, handles)
        const { resultString } = timeit('args.run()', '', '', { run }, 1, 1)
        console.log('Example02.init')
        console.log(resultString)
      }

      const { AT_B_sparse, E_sparse } = solver // eslint-disable-line
      console.log(`AT_B: [${AT_B_sparse.shape}], E.nnz: ${E_sparse.nnz()}`)
      {
        const run = () => solver.update()
        const { resultString } = timeit('args.run()', '', '', { run }, 5)
        console.log('Example02.update')
        console.log(resultString)
      }
    })
  })
})
