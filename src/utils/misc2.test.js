/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import * as Misc2 from './misc2.js'
import * as ddg from './ddg.js'

const equal = assert.strictEqual
const deepEqual = assert.deepStrictEqual

describe('misc2', () => {
  describe('makeTriangle', () => {
    it('works 0', () => {
      const { verts, f2v } = Misc2.makeTriangle(4)
      deepEqual(verts.shape, [15, 3])
      deepEqual(f2v.shape, [16, 3])
    })

    it('works 1', () => {
      const { verts, f2v } = Misc2.makeTriangle(2)
      deepEqual(verts.shape, [6, 3])
      deepEqual(f2v.shape, [4, 3])

      // [Verts]      [Edges]
      // 5            *
      // | \          7 8
      // 3 - 4        * 6 *
      // | \ | \      1 3 4 5
      // 0 - 1 - 2    * 0 * 2 *
      const { d0, d1, foundBoundary, boundaryEdge, numBoundaryEdgesPerFace } = ddg.computeTopologyV2(f2v, verts.shape[0])
      deepEqual(d0.shape, [9, 6])
      deepEqual(d1.shape, [4, 9])
      equal(foundBoundary, true)
      deepEqual(Array.from(boundaryEdge), [1, 1, 1, 0, 0, 1, 0, 1, 1])
      deepEqual(Array.from(numBoundaryEdgesPerFace), [2, 0, 2, 2])
    })
  })
})
