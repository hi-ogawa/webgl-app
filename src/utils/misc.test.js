/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import * as UtilsMisc from './misc.js'

const equal = assert.strictEqual
const deepEqual = assert.deepStrictEqual

describe('misc', () => {
  describe('makePlane', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makePlane()
      deepEqual(position, [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]])
      deepEqual(index, [[0, 1, 3], [0, 3, 2]])
    })

    it('works 1', () => {
      const { position } = UtilsMisc.makePlane(2, 2, true, true)
      deepEqual(position, [[0, 0, 0], [0.5, 0, 0], [0, 0.5, 0], [0.5, 0.5, 0]])
    })

    it('works 2', () => {
      const { position, index } = UtilsMisc.makePlane(3, 3, true, true)
      equal(position.length, 3 * 3)
      equal(index.length, 3 * 3 * 2)
      //
      // Unfortunately `makePlane(2, 2)` creates 2 different edge for same vertex pair (e.g. [0] -- [1])
      // So, it seems `makePlane(3, 3)` is the simplest example we can test with.
      //
      // [?] : vertex
      // (?) : edge
      // <?> : face
      //
      // -- makePlane(2, 2) --
      //
      //    [0] --(0)-- [1] --(?)-- [0]
      //     | <3>    /  | <7>    /  |
      //    (?)   (?)   (?)   (?)   (?)
      //     |  /   <2>  |  /   <6>  |
      //    [2] --(3)-- [3] --(?)-- [2]
      //     | <1>    /  | <5>    /  |
      //    (4)   (2)   (1)   (5)   (4)
      //     |  /   <0>  |  /   <4>  |
      //    [0] --(0)-- [1] --(?)-- [0]
      //
      // -- makePlane(3, 3) --
      //
      //    [0] --(0)-- [1] --(12)- [2] --(21)- [0]
      //     | <5>    /  | <11>   /  | <17>   /  |
      //    (11)  (10)  (9)   (20)  (19)  (26)  (11)
      //     |  /   <4>  |  /   <10> |  /   <16> |
      //    [6] --(7)-- [7] --(18)- [8] --(25)- [0]
      //     | <3>    /  | <9>    /  | <15>   /  |
      //    (8)   (6)   (5)   (17)  (16)  (24)  (8)
      //     |  /   <2>  |  /   <8>  |  /   <14> |
      //    [3] --(3)-- [4] --(15)- [5] --(23)- [2]
      //     | <1>    /  | <7>    /  | <13>   /  |
      //    (4)   (2)   (1)   (14)  (13)  (22)  (4)
      //     |  /   <0>  |  /   <6>  |  /   <12> |
      //    [0] --(0)-- [1] --(12)- [2] --(21)- [0]
    })
  })

  describe('makeTorus', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeTorus()
      equal(position.length, 512)
      equal(index.length, 32 * 16 * 2)
    })
  })
})
