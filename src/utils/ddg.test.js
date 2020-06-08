/* eslint camelcase: 0, no-unused-vars: 0 */
/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import * as UtilsMisc from './misc.js'
import * as ddg from './ddg.js'
import * as glm from './glm.js'
import fs from 'fs'
import util from 'util'
import { readOFF } from './reader.js'

/* eslint-disable no-unused-vars */
const { PI, cos, sin, pow, abs, sign, sqrt, cosh, sinh, acos, atan2 } = Math
const {
  vec2, vec3, vec4, /* mat2, mat3, mat4, */
  add, sub, mul, div, /* mmul */
  dot, cross, length, normalize,
  /* inverse, transpose, */
  pow2, dot2 /* diag, outer, outer2, */
} = glm
/* eslint-enable no-unused-vars */

const equal = assert.strictEqual
const deepEqual = assert.deepStrictEqual
const closeTo = (actual, expected, epsilon = 1e-6) => {
  if (epsilon < abs(actual - expected)) {
    assert.fail(`\nactual: ${actual}\nexpected: ${expected}\n`)
  }
}
const deepCloseTo = (actual, expected, epsilon = 1e-6) => {
  actual = _.flattenDeep(actual)
  expected = _.flattenDeep(expected)
  _.zip(actual, expected).forEach(([a, e]) => closeTo(a, e, epsilon))
}
const fsReadFile = util.promisify(fs.readFile)
const readFile = (f) => fsReadFile(f).then(buffer => buffer.toString())

describe('ddg', () => {
  describe('computeTopology', () => {
    it('works 0', () => {
      const f2v = [[0, 1, 2], [0, 2, 3]]
      const nV = 4
      const { e2v, v2ve, f2e, e2f, f2fe } = ddg.computeTopology(f2v, nV)
      // [?] : vertex
      // (?) : edge
      // <?> : face
      //  [3] --(3)-- [2]
      //   | <1>    /  |
      //  (4)   (2)   (1)
      //   |  /   <0>  |
      //  [0] --(0)-- [1]
      assert.deepStrictEqual(e2v, [[0, 1], [1, 2], [2, 0], [2, 3], [3, 0]])
      assert.deepStrictEqual(f2e, [
        [[0, 1], [1, 1], [2, 1]],
        [[2, -1], [3, 1], [4, 1]]
      ])
      assert.deepStrictEqual(e2f, [
        [[0, 1]],
        [[0, 1]],
        [[0, 1], [1, -1]],
        [[1, 1]],
        [[1, 1]]
      ])
      assert.deepStrictEqual(v2ve, [
        [[1, 0, 1], [2, 2, -1], [3, 4, -1]],
        [[0, 0, -1], [2, 1, 1]],
        [[1, 1, -1], [0, 2, 1], [3, 3, 1]],
        [[2, 3, -1], [0, 4, 1]]
      ])
      assert.deepStrictEqual(f2fe, [
        [[1, 2, 1]],
        [[0, 2, -1]]
      ])
    })

    it('works 1', () => {
      const { position, index } = UtilsMisc.makeHedron8()
      const nV = position.length
      const { e2v, v2ve, f2e, e2f, f2fe } = ddg.computeTopology(index, nV)
      assert.deepStrictEqual(e2v, [
        [0, 1],
        [1, 2], [2, 0],
        [2, 3], [3, 0],
        [3, 4], [4, 0],
        [4, 1],
        [5, 2], [1, 5], [5, 3], [5, 4]
      ])
      assert.deepStrictEqual(f2e, [
        [[0, 1], [1, 1], [2, 1]],
        [[2, -1], [3, 1], [4, 1]],
        [[4, -1], [5, 1], [6, 1]],
        [[6, -1], [7, 1], [0, -1]],
        [[8, 1], [1, -1], [9, 1]],
        [[10, 1], [3, -1], [8, -1]],
        [[11, 1], [5, -1], [10, -1]],
        [[9, -1], [7, -1], [11, -1]]
      ])
    })
  })

  describe('computeMore', () => {
  // cf. Decartes's theorem
    const toEuler = (angleSum) => {
      const angleDefect = angleSum.map(a => 2 * PI - a) // aka. discrete Gaussian curvature
      const totalDefect = _.sum(angleDefect) // aka. Euler characteristics
      return totalDefect / (2 * PI)
    }

    it('works 0', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeHedron8()
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { angleSum } = ddg.computeMore(verts, f2v, topology)
      closeTo(toEuler(angleSum), 2)
    })

    it('works 1', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/3holes.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { angleSum } = ddg.computeMore(verts, f2v, topology)
      const g = 3
      closeTo(toEuler(angleSum), 2 - 2 * g)
    })

    it('works 2', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeIcosphere(3)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { hodge0, angleSum } = ddg.computeMore(verts, f2v, topology)
      closeTo(toEuler(angleSum), 2)

      // Discrete Gaussian curvature as primal 0-form
      const kG = _.zip(angleSum, hodge0).map(([angle, h0]) => ((2 * PI) - angle) / h0)

      // Gaussign curvature of unit sphere = 1 * 1 = 1
      deepCloseTo(kG, _.range(nV).fill(1), 1e-2)
    })

    // TODO
    // it('benchmark', () => {
    //   // V: 12  =>  V + E
    //   // E: 30  =>  E x 2 + F x 3
    //   // F: 20  =>  F x 4
    //   const { position: verts, index: f2v } = UtilsMisc.makeIcosphere(3)
    //   const nV = verts.length
    //   const topology = ddg.computeTopology(f2v, nV)
    //   const { hodge0, angleSum } = ddg.computeMore(verts, f2v, topology)
    // })
  })

  describe('computeLaplacian', () => {
    it('works 0', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeHedron8()
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { hodge1 } = ddg.computeMore(verts, f2v, topology)
      const { e2v } = topology
      const laplacian = ddg.computeLaplacian(nV, e2v, hodge1)
      const h2 = ddg.computeMeanCurvature(verts, laplacian)
      deepCloseTo(h2, [
        [-2.3, 0, 0],
        [0, -2.3, 0],
        [0, 0, -2.3],
        [0, 2.3, 0],
        [0, 0, 2.3],
        [2.3, 0, 0]
      ], 1e-2)
    })

    it('works 1', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeIcosphere(1)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { hodge0, hodge1, angleSum } = ddg.computeMore(verts, f2v, topology)
      const { e2v } = topology
      const L = ddg.computeLaplacian(nV, e2v, hodge1)
      const HN2 = ddg.computeMeanCurvature(verts, L)

      // Discrete mean curvature as primal 0-form
      const HN2_primal = _.zip(HN2, hodge0).map(([hn2, h0]) => div(hn2, h0))

      // Mean curvature of unit sphere = (1 + 1) / 2 = 1
      const expected = verts.map(p => mul(-2, p))
      deepCloseTo(HN2_primal, expected)
    })

    it('works 2', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { hodge1 } = ddg.computeMore(verts, f2v, topology)
      const { e2v } = topology
      const L = ddg.computeLaplacian(nV, e2v, hodge1)
      const HN2 = ddg.computeMeanCurvature(verts, L)
    })
  })

  describe('computeSpanningTree', () => {
    it('works 0', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeHedron8()
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const root = 0
      const treeV = ddg.computeSpanningTree(root, topology.v2ve)
      const treeF = ddg.computeSpanningTree(root, topology.f2fe)
      deepEqual(treeV.map(veos => veos.map(veo => veo[0])), [
        [1, 2, 3, 4], [5], [], [], [], []
      ])
      deepEqual(treeF.map(veos => veos.map(veo => veo[0])), [
        [3, 4, 1], [], [6], [2, 7], [5], [], [], []
      ])
    })

    it('works 1', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeHedron8()
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const nE = topology.e2f.length
      const root = 0
      const resultV = ddg.computeSpanningTreeV2(root, topology.v2ve, nE)
      const resultF = ddg.computeSpanningTreeV2(root, topology.f2fe, nE, resultV.usedEdges)
      const edgesV = _.range(nE).filter(e => resultV.usedEdges[e])
      const edgesF = _.range(nE).filter(e => resultF.usedEdges[e])
      deepEqual(edgesV, [0, 2, 4, 6, 9])
      deepEqual(edgesF, [1, 3, 5, 7, 8, 10, 11])
    })
  })

  describe('computeTreeCotree', () => {
    it('works 0', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeHedron8()
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { v2ve, f2fe, e2f } = topology
      const rootV = 0
      const rootF = 0
      const { loops } = ddg.computeTreeCotree(rootV, rootF, v2ve, f2fe, e2f)
      deepEqual(loops, [])
    })

    it('works 1', () => {
      // See misc.test.js for the diagram showing topology
      const { position: verts, index: f2v } = UtilsMisc.makePlane(3, 3, true, true)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { e2v, v2ve, f2fe, e2f } = topology
      const nE = e2v.length
      const nF = f2v.length
      equal(nV - nE + nF, 0) // g = 1

      const rootV = 0
      const rootF = 0
      const { loops } = ddg.computeTreeCotree(rootV, rootF, v2ve, f2fe, e2f)
      deepEqual(loops, [
        [2, 3, 6, 7, 10, 0],
        [1, 14, 13, 23, 8, 7, 10, 0]
      ])
    })
  })
})
