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
import { Matrix, MatrixCOO, MatrixCSR, splitByIndptr } from './array.js'

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
  if (actual.length !== expected.length) {
    assert.fail(`\nactual: ${actual}\nexpected: ${expected}\n`)
  }
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

    it('works 2 (quad)', () => {
      const { position, index } = UtilsMisc.makeQuadCube()
      const nV = position.length
      const { e2v, f2e } = ddg.computeTopology(index, nV)
      assert.deepStrictEqual(e2v, [
        [0, 3], [3, 2],
        [2, 1], [1, 0],
        [1, 5], [5, 4],
        [4, 0], [2, 6],
        [6, 5], [3, 7],
        [7, 6], [4, 7]
      ])
      assert.deepStrictEqual(f2e, [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[3, -1], [4, 1], [5, 1], [6, 1]],
        [[2, -1], [7, 1], [8, 1], [4, -1]],
        [[1, -1], [9, 1], [10, 1], [7, -1]],
        [[0, -1], [6, -1], [11, 1], [9, -1]],
        [[5, -1], [8, -1], [10, -1], [11, -1]]
      ])
    })

    it('works 3 (bunny)', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const { e2v, f2e } = ddg.computeTopology(f2v, nV)
      const nE = e2v.length
      const nF = f2v.length
      equal(nV - nE + nF, 2)
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
  })

  describe('computeMoreV2', () => {
    it('works 0', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeHedron8()
      let result1
      let result2
      {
        const nV = verts.length
        const nF = f2v.length
        const topology = ddg.computeTopology(f2v, nV)
        result1 = ddg.computeMore(verts, f2v, topology)
      }
      {
        const nV = verts.length
        const nF = f2v.length
        const vertsM = Matrix.empty([nV, 3])
        vertsM.data.set(verts.flat())
        const f2vM = Matrix.empty([nF, 3], Uint32Array)
        f2vM.data.set(f2v.flat())
        result2 = ddg.computeMoreV2(vertsM, f2vM)
      }
      const kg = result1.angleSum.map(a => 2 * PI - a)
      deepCloseTo(kg, result2.kg.data)
      deepCloseTo(result1.hodge0, result2.hodge0.data)
    })

    it('works 1', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeIcosphere(1)
      let result1
      let result2
      {
        const nV = verts.length
        const nF = f2v.length
        const topology = ddg.computeTopology(f2v, nV)
        result1 = ddg.computeMore(verts, f2v, topology)
      }
      {
        const nV = verts.length
        const nF = f2v.length
        const vertsM = Matrix.empty([nV, 3])
        vertsM.data.set(verts.flat())
        const f2vM = Matrix.empty([nF, 3], Uint32Array)
        f2vM.data.set(f2v.flat())
        result2 = ddg.computeMoreV2(vertsM, f2vM)
      }
      const kg = result1.angleSum.map(a => 2 * PI - a)
      deepCloseTo(kg, result2.kg.data)
      deepCloseTo(result1.hodge0, result2.hodge0.data)
    })

    it('works 2', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      let result1
      let result2
      {
        const nV = verts.length
        const nF = f2v.length
        const topology = ddg.computeTopology(f2v, nV)
        result1 = ddg.computeMore(verts, f2v, topology)
      }
      {
        const nV = verts.length
        const nF = f2v.length
        const vertsM = Matrix.empty([nV, 3])
        vertsM.data.set(verts.flat())
        const f2vM = Matrix.empty([nF, 3], Uint32Array)
        f2vM.data.set(f2v.flat())
        result2 = ddg.computeMoreV2(vertsM, f2vM)
      }
      const kg = result1.angleSum.map(a => 2 * PI - a)
      deepCloseTo(kg, result2.kg.data)
      deepCloseTo(result1.hodge0, result2.hodge0.data)
    })
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

      {
        const nV = verts.length
        const nF = f2v.length
        const vertsM = Matrix.empty([nV, 3])
        vertsM.data.set(verts.flat())
        const f2vM = Matrix.empty([nF, 3], Uint32Array)
        f2vM.data.set(f2v.flat())
        const L = ddg.computeLaplacianV2(vertsM, f2vM)
        const result = L.matmul(Matrix.empty(vertsM.shape), vertsM)
        // TODO: fix
        // deepCloseTo(Array.from(result.data), h2)
      }
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
      let result1
      let result2
      {
        const nV = verts.length
        const nF = f2v.length
        const topology = ddg.computeTopology(f2v, nV)
        const { hodge1 } = ddg.computeMore(verts, f2v, topology)
        const { e2v } = topology
        const L = ddg.computeLaplacian(nV, e2v, hodge1)
        result1 = ddg.computeMeanCurvature(verts, L)
      }
      {
        const nV = verts.length
        const nF = f2v.length
        const vertsM = Matrix.empty([nV, 3])
        vertsM.data.set(verts.flat())
        const f2vM = Matrix.empty([nF, 3], Uint32Array)
        f2vM.data.set(f2v.flat())
        const L = ddg.computeLaplacianV2(vertsM, f2vM)
        result2 = Matrix.empty(vertsM.shape)
        L.matmul(result2, vertsM)
      }
      deepCloseTo(result1.flat(), Array.from(result2.data))
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

  describe('solveGaussSeidel', () => {
    const toSparse = (A) => {
      const nV = A.length
      const B = _.range(nV).map(() => new Map())
      for (const i of _.range(nV)) {
        for (const j of _.range(nV)) {
          B[i].set(j, A[i][j])
        }
      }
      return B
    }

    it('works 0', async () => {
      // weak-diag-dominant matrix
      const A = [
        [2, -1, 0, -1],
        [-1, 2, -1, 0],
        [0, -1, 2, -1],
        [-1, 0, -1, 2]
      ]
      const A_sparse = toSparse(A)
      const x0 = [0, 0, 0, 0]
      const b = [-1, 2, 0, -1]
      const x = ddg.solveGaussSeidel(A_sparse, x0, b, 1e-6, 8)
      const Ax = A.map(row => glm.dot(row, x))
      deepCloseTo(Ax, b, 1e-4)
    })
  })

  describe('solvePoisson', () => {
    it('works 0', async () => {
      const { position: verts, index: f2v } = UtilsMisc.makeIcosphere(1)
      const nV = verts.length
      const rho_dual = _.range(nV).fill(0)

      // 0/11 cooresponds to north/south pole
      rho_dual[0] = 1
      rho_dual[11] = -1

      // TODO: test some analytically extected property
      const u = ddg.solvePoisson(verts, f2v, rho_dual)
    })
  })

  describe('computeTopologyV2', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeHedron8()
      const nV = position.length
      const nF = index.length
      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      const { d0, d1, foundBoundary } = ddg.computeTopologyV2(f2v, nV)
      equal(foundBoundary, false)
      deepEqual(d0.shape, [12, 6]) // nE x nV
      deepEqual(d1.shape, [8, 12]) // nF x nE
      deepEqual(splitByIndptr(d0.indptr, d0.indices), [
        [0, 1], // 0
        [0, 2], // 1
        [0, 3], // 2
        [0, 4], // 3
        [1, 2], // 4
        [1, 4], // 5
        [1, 5], // 6
        [2, 3], // 7
        [2, 5], // 8
        [3, 4], // 9
        [3, 5], // 10
        [4, 5] // 11
      ])
      deepEqual(splitByIndptr(d1.indptr, d1.indices), [
        [0, 1, 4],
        [1, 2, 7],
        [2, 3, 9],
        [0, 3, 5],
        [4, 6, 8],
        [7, 8, 10],
        [9, 10, 11],
        [5, 6, 11]
      ])
      deepEqual(splitByIndptr(d1.indptr, d1.data), [
        [1, -1, 1],
        [1, -1, 1],
        [1, -1, 1],
        [-1, 1, -1],
        [-1, 1, -1],
        [-1, 1, -1],
        [-1, 1, -1],
        [1, -1, 1]
      ])

      // d . d = 0
      const dd = d1.clone().matmulCsr(d0)
      deepCloseTo(dd.data, _.range(dd.data.length).fill(0))

      // edge vectors = d0 . p
      const edges = Matrix.empty([d0.shape[0], 3])
      d0.matmul(edges, verts)
      deepCloseTo(_.chunk(edges.data, 3), [
        [-1, 1, 0], [-1, 0, 1],
        [-1, -1, 0], [-1, 0, -1],
        [0, -1, 1], [0, -1, -1],
        [-1, -1, 0], [0, -1, -1],
        [-1, 0, -1], [0, 1, -1],
        [-1, 1, 0], [-1, 0, 1]
      ])
    })
  })

  describe('computeHodge1', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeHedron8()
      const nV = position.length
      const nF = index.length
      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      const { d0, d1 } = ddg.computeTopologyV2(f2v, nV)

      // Laplacian = dual(d1) hodge1 d0 = - d0^T hodge1 d0
      const { hodge1 } = ddg.computeHodge1(verts, f2v, d0, d1)
      const _d0 = d0.toDense()
      const _d1 = _d0.transpose().muleqs(-1)
      const _h1 = MatrixCSR.fromDiagonal(hodge1.data).toDense()
      const d1h1d0 = _d1.matmul(_h1).matmul(_d0)

      const laplacian = ddg.computeLaplacianV2(verts, f2v)
      deepCloseTo(laplacian.toDense().data, d1h1d0.data)
    })

    it('works 1', () => {
      const { position, index } = UtilsMisc.makeIcosphere(0)
      const nV = position.length
      const nF = index.length
      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      const { d0, d1, foundBoundary } = ddg.computeTopologyV2(f2v, nV)
      equal(foundBoundary, false)

      const dd = d1.clone().matmulCsr(d0)
      deepCloseTo(dd.data, _.range(dd.data.length).fill(0))

      const { hodge1 } = ddg.computeHodge1(verts, f2v, d0, d1)
      const _d0 = d0.toDense()
      const _d1 = _d0.transpose().muleqs(-1)
      const _h1 = MatrixCSR.fromDiagonal(hodge1.data).toDense()
      const d1h1d0 = _d1.matmul(_h1).matmul(_d0)

      const laplacian = ddg.computeLaplacianV2(verts, f2v)
      deepCloseTo(laplacian.toDense().data, d1h1d0.data)
    })
  })

  describe('computeF2f', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeHedron8()
      const nV = position.length
      const nF = index.length
      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      const { d0, d1 } = ddg.computeTopologyV2(f2v, nV)
      const f2f = ddg.computeF2f(d1)
      deepCloseTo(f2f.toDense().data, [
        0, -2, 0, 1, 5, 0, 0, 0,
        2, 0, -3, 0, 0, 8, 0, 0,
        0, 3, 0, -4, 0, 0, 10, 0,
        -1, 0, 4, 0, 0, 0, 0, -6,
        -5, 0, 0, 0, 0, -9, 0, 7,
        0, -8, 0, 0, 9, 0, -11, 0,
        0, 0, -10, 0, 0, 11, 0, -12,
        0, 0, 0, 6, -7, 0, 12, 0
      ])
    })
  })

  describe('computeSpanningTreeV3', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeHedron8()
      const nV = position.length
      const nF = index.length
      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      const { d0, d1 } = ddg.computeTopologyV2(f2v, nV)
      const f2f = ddg.computeF2f(d1)
      const tree = ddg.computeSpanningTreeV3(0, f2f)
      deepCloseTo(tree.toDense().data, [
        0, -2, 0, 1, 5, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 10, 0,
        0, 0, 4, 0, 0, 0, 0, -6,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 11, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0
      ])
    })
  })

  describe('solveConnection', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeIcosphere(1)
      const nV = position.length
      const nF = index.length

      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      //
      // [ Prop: Discrete trivial connection probelm is Poisson problem ]
      //
      // Given
      //   - phi \in dual(\Omega_1)
      //   - ||phi|| = < phi, hodge1^{-1} phi >  (cf. inner product on 1 form)
      //   - dual(d1) = d0^T
      // Then
      //   min ||phi|| s.t. dual(d1) = b
      //   implies, by Lagrange multiplier, for some u,
      //   phi = hodge1 d0 u
      //   i.e. dual(d1) hodge1 d0 u = laplacian u = b
      //
      //
      // [ Overview ]
      //
      // - 0. Convention
      //   - CCW dual edge (thus dual(d1) = - d0^T, dual(d2) = d1^T)
      //
      // - 1. Construct
      //   - laplacian (laplacian = - d0^T hodge1 d0)
      //   - kg
      //
      // - 2. Define
      //   - (s_i)_i:  singularity index on dual face s.t. \sum_i s_i = \Kai = 2 - 2g)
      //
      // - 3. Solve u s.t.
      //   - L u = b = - kg + 2pi s
      //
      // - 4. Construct
      //   - hodge1, d0
      //   - phi = hodge1 d0 u
      //   - cotree F_T \subset F
      //   - edge vector
      //   - face normal
      //
      // - 5. Define
      //   - v \in S^2: initial unit vector
      //   - f0 \in F: initial face to start vector field propagation
      //
      // - 6. Propagate
      //   - v from f0 along \phi and F_T
      //

      // 1.
      let { laplacian, kg } = ddg.computeMoreV2(verts, f2v)
      laplacian = MatrixCSR.fromCOO(laplacian)
      laplacian.sumDuplicates()

      // 2.
      const sindex = Matrix.empty([nV, 1])
      sindex.data[0] = 1 // north pole
      sindex.data[11] = 1 // south pole

      // 3.
      const Lneg = laplacian.clone().negadddiags(1e-3) // = - L + h I (positive definite)
      const u = Matrix.emptyLike(sindex)
      const b = sindex.clone().muleqs(2 * PI).subeq(kg)
      const bneg = b.clone().muleqs(-1)
      closeTo(b.sum(), 0, 1e-3)

      for (let i = 0; i < 64; i++) {
        Lneg.stepGaussSeidel(u, bneg)
        const residue = Lneg.matmul(u.clone(), u).subeq(bneg).dotHS2()
        if (residue < 1e-3) {
          console.log(`residue (${i}): ${residue}`)
          break
        }
        if (i % 8 === 0) {
          console.log(`residue (${i}): ${residue}`)
        }
      }

      // 4. phi = hodge1 d0 u
      const { d0, d1 } = ddg.computeTopologyV2(f2v, nV)
      const { hodge1, edges } = ddg.computeHodge1(verts, f2v, d0, d1) // float[nE, 1]
      const phi = Matrix.emptyLike(hodge1)
      d0.matmul(phi, u).muleq(hodge1)

      // b = L u = - d0^T hodge1 d0 u
      deepCloseTo(b.data, d0.matmulT(Matrix.emptyLike(b), phi).muleqs(-1).data, 0.1)

      // Face normal (from d1 and edges)
      // const normal =

      // Cotree
    })
  })
})
