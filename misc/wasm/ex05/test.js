/* global describe, it */

const assert = require('assert')
const { performance } = require('perf_hooks')
const { requireEm } = require('../utils.js')
const _ = require('lodash')

describe('wasm', () => {
  describe('ex05', () => {
    it('works', async () => {
      const { Vector, solve } = await requireEm('./ex05/build/js/Release/em.js') // relative to ./utils.js
      const n = 3
      const u1 = Vector.zeros(9 * n)
      const u2 = Vector.zeros(9 * n)
      const p = Vector.zeros(9 * n)
      u1.data().set([
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
        //
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
        //
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ])
      u2.data().set([
        0, 1, 0,
        0, 0, 1,
        1, 0, 0,
        //
        0, 0, 1,
        1, 0, 0,
        0, 1, 0,
        //
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ])

      solve(u1, u2, p)
      assert(_.zip(u2.data(), p.data()).every(([a, b]) => Math.abs(a - b) < 1e-5))

      // [ Debug ]
      // console.log(_.chunk(p.data(), 9).map(a => _.chunk(a, 3).join('\n')).join('\n- - - - - - -\n'))

      u1.delete()
      u2.delete()
      p.delete()
    })
  })
})
