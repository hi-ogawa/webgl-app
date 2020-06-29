/* global describe, it */

import assert from 'assert'
import * as physics from './physics.js'
import * as misc2 from './misc2.js'

describe('physics', () => {
  describe('Example00', () => {
    it('works', () => {
      const solver = new physics.Example00()
      solver.init()

      const { x, dt } = solver
      const duration = 1
      const N = duration * Math.ceil(1 / dt)
      for (let i = 0; i < N; i++) {
        solver.update()
      }
      assert(x.data.every(i => !Number.isNaN(i)))
    })
  })

  describe('Example01', () => {
    it('works', function () {
      this.timeout(10000)

      const { verts, f2v } = misc2.makeTriangle(8)
      const handles = [{ vertex: 0, target: [0, 0, 0] }]
      const solver = new physics.Example01()
      solver.init(verts, f2v, handles)

      const { x, AT_B_sparse } = solver // eslint-disable-line
      console.log(`AT_B: [${AT_B_sparse.shape}]`)

      for (let i = 0; i < 60; i++) {
        solver.update()
        assert(x.data.every(i => !Number.isNaN(i)))
      }
    })
  })

  describe('Example02', () => {
    it('works', function () {
      this.timeout(10000)

      const n = 4
      const { verts, c3xc0 } = misc2.makeTetrahedralizedCubeSymmetric(n / 2)
      const handles = [{ vertex: 0, target: [0, 0, 0] }]
      const solver = new physics.Example02()
      solver.init(verts, c3xc0, handles)

      const { x, AT_B_sparse } = solver // eslint-disable-line
      console.log(`nC0: ${verts.shape[0]}, nC3: ${c3xc0.shape[0]}, AT_B: [${AT_B_sparse.shape}]`)

      for (let i = 0; i < 60; i++) {
        solver.update()
        assert(x.data.every(i => !Number.isNaN(i)))
      }
    })
  })
})
