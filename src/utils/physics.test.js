/* global describe, it */

import { Example00 } from './physics.js'

describe('physics', () => {
  describe('Example00', () => {
    it('works', () => {
      const solver = new Example00()
      solver.init()

      const { dt } = solver
      const duration = 1
      const N = duration * Math.ceil(1 / dt)
      for (let i = 0; i < N; i++) {
        solver.update()
      }
    })
  })
})
