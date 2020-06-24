/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import * as Misc2 from './misc2.js'

const equal = assert.strictEqual
const deepEqual = assert.deepStrictEqual

describe('misc2', () => {
  describe('makeTriangle', () => {
    it('works 0', () => {
      const { verts, f2v } = Misc2.makeTriangle(4)
      deepEqual(verts.shape, [15, 3])
      deepEqual(f2v.shape, [16, 3])
    })
  })
})
