/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import * as UtilsMisc from './misc.js'
import * as ddg from './ddg.js'

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

  describe('extrudeFaces', () => {
    it('works 0', () => {
      const nV = 6
      const f2v = [[0, 1, 4, 3], [1, 2, 5, 4]]
      const f2v_new = UtilsMisc.extrudeFaces(nV, f2v)
      equal(f2v_new.length, 2 * 2 + 6)
    })

    it('works 1', () => {
      // Make donut plane like this
      //   +-+-+-+
      //   |x|x|x|
      //   +-+-+-+
      //   |x| |x|
      //   +-+-+-+
      //   |x|x|x|
      //   +-+-+-+
      const { position, index } = UtilsMisc.makePlane(3, 3, false, false, false)
      const nV = position.length
      _.remove(index, face => _.isEqual(face, [5, 6, 10, 9])) // crop out center face
      const f2v_new = UtilsMisc.extrudeFaces(nV, index)
      equal(f2v_new.length, 8 * 2 + 16)
    })
  })

  describe('makeGTorus', () => {
    it('works 0', () => {
      const g = 3
      const { position, index } = UtilsMisc.makeGTorus(g)
      const nV = position.length
      const { e2v } = ddg.computeTopology(index, nV)
      const nE = e2v.length
      const nF = index.length
      equal(nV - nE + nF, 2 - 2 * g)
    })

    it('works 1', () => {
      const g = 2
      const subdiv = 2
      const { position, index } = UtilsMisc.makeGTorus(g, subdiv)
      const nV = position.length
      const { e2v } = ddg.computeTopology(index, nV)
      const nE = e2v.length
      const nF = index.length
      equal(nV - nE + nF, 2 - 2 * g)
    })
  })

  describe('subdivCatmullClerk', () => {
    it('works 0', () => {
      let { position, index } = UtilsMisc.makeQuadCube();
      [position, index] = UtilsMisc.subdivCatmullClerk(position, index)
      equal(position.length, 8 + 12 + 6)
      equal(index.length, 6 * 4)
    })
  })
})
