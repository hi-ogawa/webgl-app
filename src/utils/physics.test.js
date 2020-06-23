/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import { equal, deepEqual } from './test-misc.js'
import { Matrix, MatrixCOO, MatrixCSR } from './array.js'
import * as glm from './glm.js'
import { Example00 } from './physics.js'

describe('physics', () => {
  describe('Example00', () => {
    it('works', () => {
      const solver = new Example00()
      solver.init()

      const { x, nV, dt } = solver
      const duration = 8
      const N = duration * Math.ceil(1 / dt)
      for (let i = 0; i < N; i++) {
        solver.update()
      }
    })
  })
})
