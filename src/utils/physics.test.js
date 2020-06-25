/* global describe, it */

import assert from 'assert'
import { Example00, Example01 } from './physics.js'

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
    it('works', () => {
      const solver = new Example01()
      solver.init()

      const { xx } = solver
      solver.update()
      assert(xx.data.every(i => !Number.isNaN(i)))
    })
  })
})
