/* eslint camelcase: 0 */
/* global describe, it, before */

import fs from 'fs'
import * as physics from './physics.js'
import { timeit } from './timeit.js'
import * as misc2 from './misc2.js'
import * as reader from './reader.js'

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
    // Load wasm if avilable (not available in CI for now)
    // TODO: Fix not loading emscripten in "*.test.js" due to "mocha_jsdom.js"
    let wasm_ex05
    before(async () => {
      try {
        const { default: Module } = await import('../../misc/wasm/ex05/build/js/Release/em.js')
        await new Promise(resolve => {
          Module.postRun = resolve // Wait until emscripten is ready
          wasm_ex05 = Module
        })
      } catch {}
    })

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

      {
        const run = () => solver.svdProjection()
        const { resultString } = timeit('args.run()', '', '', { run }, 5)
        console.log('Example02.svdProjection')
        console.log(resultString)
      }

      if (wasm_ex05) {
        solver.setupWasm(wasm_ex05)
        const run = () => solver.svdProjectionWasm()
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('Example02.svdProjectionWasm')
        console.log(resultString)
      }
    })

    it('works 1', () => {
      const data = fs.readFileSync('misc/data/monkey.mesh').toString()
      const { verts, c3xc0 } = reader.readMESH(data)
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

      {
        const run = () => solver.svdProjection()
        const { resultString } = timeit('args.run()', '', '', { run }, 5)
        console.log('Example02.svdProjection')
        console.log(resultString)
      }

      if (wasm_ex05) {
        solver.setupWasm(wasm_ex05)
        const run = () => solver.svdProjectionWasm()
        const { resultString } = timeit('args.run()', '', '', { run })
        console.log('Example02.svdProjectionWasm')
        console.log(resultString)
      }
    })
  })
})
