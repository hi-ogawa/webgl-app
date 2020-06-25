/* global describe, it */

import assert from 'assert'
import { Example00, Example01 } from './physics.js'
import * as misc2 from './misc2.js'

describe('physics', () => {
  describe('Example00', () => {
    it('works', () => {
      const solver = new Example00()
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
      const solver = new Example01()
      solver.init(verts, f2v, handles)

      const { x } = solver
      for (let i = 0; i < 60; i++) {
        solver.update()
        assert(x.data.every(i => !Number.isNaN(i)))
      }
    })
  })
})
