/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import _ from '../../web_modules/lodash.js'
import * as UtilsMisc from './misc.js'
import * as ddg from './ddg.js'
import * as glm from './glm.js'
import fs from 'fs'
import util from 'util'
import { readOFF, writeOFF, readMESH, readELENODE } from './reader.js' // eslint-disable-line
import { hash11 } from './hash.js'
import { Matrix, MatrixCSR, splitByIndptr } from './array.js'
import { equal, deepEqual, closeTo, deepCloseTo } from './test-misc.js'

const { PI } = Math

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
      const { e2v, f2e } = ddg.computeTopology(index, nV)
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
      const { e2v } = ddg.computeTopology(f2v, nV)
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
        const result = L.matmul(Matrix.empty(vertsM.shape), vertsM) // eslint-disable-line no-unused-vars
        // TODO: fix
        // deepCloseTo(Array.from(result.data), h2)
      }
    })

    it('works 1', () => {
      const { position: verts, index: f2v } = UtilsMisc.makeIcosphere(1)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const { hodge0, hodge1 } = ddg.computeMore(verts, f2v, topology)
      const { e2v } = topology
      const L = ddg.computeLaplacian(nV, e2v, hodge1)
      const HN2 = ddg.computeMeanCurvature(verts, L)

      // Discrete mean curvature as primal 0-form
      const HN2_primal = _.zip(HN2, hodge0).map(([hn2, h0]) => glm.vec3.divs(hn2, h0))

      // Mean curvature of unit sphere = (1 + 1) / 2 = 1
      const expected = verts.map(p => glm.vec3.muls(p, -2))
      deepCloseTo(HN2_primal, expected)
    })

    it('works 2', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      let result1
      let result2
      {
        const nV = verts.length
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
      const Ax = A.map(row => _.sum(_.zip(row, x).map(([a, b]) => a * b)))
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
      const u = ddg.solvePoisson(verts, f2v, rho_dual) // eslint-disable-line no-unused-vars
    })
  })

  describe('computeTopologyV2', () => {
    it('camelhead', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/camelhead.off')
      let { verts, f2v } = readOFF(data, true)
      verts = new Matrix(verts, [verts.length / 3, 3])
      f2v = new Matrix(f2v, [f2v.length / 3, 3])
      const { foundBoundary, boundaryEdge, numBoundaryEdgesPerFace } =
        ddg.computeTopologyV2(f2v, verts.shape[0])
      equal(foundBoundary, true)
      equal(boundaryEdge.reduce(_.add), 56)
      equal(numBoundaryEdgesPerFace.filter(n => n > 0).length, 56)
      equal(numBoundaryEdgesPerFace.every(n => n === 0 || n === 1), true)

      // We can canonically obtain boundary based on boundary operator (i.e. adjoint of exterior derivative)
      {
        const nC0 = verts.shape[0]
        const c2xc0 = f2v
        const { c1xc0, d1 } = ddg.computeD1(c2xc0, nC0, true)
        const { d0 } = ddg.computeD0(c1xc0, nC0)
        const { c1B, c0B } = ddg.computeBoundaryC2(d0, d1)

        // Boundary edges
        equal(c1B.data.filter(v => v !== 0).length, 56)

        // Boundary vertices
        equal(c0B.data.filter(v => v !== 0).length, 56)
      }
    })

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

      const { d1 } = ddg.computeTopologyV2(f2v, nV)
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

      const { d1 } = ddg.computeTopologyV2(f2v, nV)
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

  describe('computeFaceNormals', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeHedron8()
      const nV = position.length
      const nF = index.length
      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      const normals = ddg.computeFaceNormals(verts, f2v)
      normals.muleqs(Math.sqrt(3))
      deepCloseTo(normals.data, [
        1, 1, 1,
        1, -1, 1,
        1, -1, -1,
        1, 1, -1,
        -1, 1, 1,
        -1, -1, 1,
        -1, -1, -1,
        -1, 1, -1
      ])
    })
  })

  describe('computeFaceCentroids', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeIcosphere(0)
      const nV = position.length
      const nF = index.length
      const verts = Matrix.empty([nV, 3])
      verts.data.set(position.flat())
      const f2v = Matrix.empty([nF, 3], Uint32Array)
      f2v.data.set(index.flat())

      const centers = ddg.computeFaceCentroids(verts, f2v)
      deepEqual(centers.shape, [nF, 3])
    })
  })

  describe('VectorFieldSolver', () => {
    it('works 0', () => {
      const { position, index } = UtilsMisc.makeIcosphere(2)
      const verts = Matrix.empty([position.length, 3])
      const f2v = Matrix.empty([index.length, 3], Uint32Array)
      verts.data.set(position.flat())
      f2v.data.set(index.flat())
      const nV = verts.shape[0]

      // Instantiate solver
      const solver = new ddg.VectorFieldSolver()

      // Solver inputs
      const initFace = 0
      const initAngle = 0
      const singularity = Matrix.empty([nV, 1])
      singularity.data[0] = 1
      singularity.data[11] = 1

      // Run several compute steps
      solver.compute1(verts, f2v)
      solver.compute2(singularity)
      solver.compute3(initFace, initAngle)

      // Check residue (this residue is only about `solver.compute2`)
      equal(solver.residue < 1e-3, true)
    })

    it('works 1', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      let { verts, f2v } = readOFF(data, true)
      verts = new Matrix(verts, [verts.length / 3, 3])
      f2v = new Matrix(f2v, [f2v.length / 3, 3])
      const nV = verts.shape[0]

      // Instantiate solver
      const solver = new ddg.VectorFieldSolver()

      // Solver inputs
      const initFace = 0
      const initAngle = 0
      const singularity = Matrix.empty([nV, 1])
      singularity.data[Math.floor(hash11(0x1357) * nV)] = 1
      singularity.data[Math.floor(hash11(0x9bdf) * nV)] = 1

      // Run several compute steps
      solver.compute1(verts, f2v)
      solver.compute2(singularity)
      solver.compute3(initFace, initAngle)

      const { vectorField, phi, residue } = solver

      assert(vectorField.data.every(x => !Number.isNaN(x)))
      assert(phi.data.every(x => !Number.isNaN(x)))
      assert(residue < 0.01)
      assert(_.max(phi.data) > 2) // looks too much rotation...
      assert(_.min(phi.data) < -1)
    })
  })

  describe('computeD2', () => {
    it('works 0', () => {
      //
      //  3
      //  |      2
      //  |    /
      //  |  /
      //  0 ----- 1
      //
      const c3xc0 = Matrix.empty([1, 4], Uint32Array)
      c3xc0.data.set([0, 1, 2, 3])
      const nC0 = 4
      const nC3 = c3xc0.shape[0]

      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0)
      const nC2 = c2xc0.shape[0]

      const { c1xc0, d1 } = ddg.computeD1(c2xc0, nC0, false)
      const nC1 = c1xc0.shape[0]

      const { d0 } = ddg.computeD0(c1xc0, nC0)

      deepCloseTo([nC0, nC1, nC2, nC3], [4, 6, 4, 1])
      deepCloseTo(nC0 - nC1 + nC2 - nC3, 1) // Euler characteristics
      deepCloseTo(c2xc0.shape, [nC2, 3])
      deepCloseTo(c1xc0.shape, [nC1, 2])
      deepCloseTo(d2.shape, [nC3, nC2])
      deepCloseTo(d1.shape, [nC2, nC1])
      deepCloseTo(d0.shape, [nC1, nC0])

      deepCloseTo(c2xc0.data, [
        0, 1, 2,
        0, 1, 3,
        0, 2, 3,
        1, 2, 3
      ])
      deepCloseTo(c1xc0.data, [
        0, 1,
        0, 2,
        0, 3,
        1, 2,
        1, 3,
        2, 3
      ])
      deepCloseTo(d2.toDense().data, [
        -1, 1, -1, 1
      ])
      deepCloseTo(d1.toDense().data, [
        1, -1, 0, 1, 0, 0,
        1, 0, -1, 0, 1, 0,
        0, 1, -1, 0, 0, 1,
        0, 0, 0, 1, -1, 1
      ])
      deepCloseTo(d0.toDense().data, [
        -1, 1, 0, 0,
        -1, 0, 1, 0,
        -1, 0, 0, 1,
        0, -1, 1, 0,
        0, -1, 0, 1,
        0, 0, -1, 1
      ])

      // de Rham co-chain
      //         d0          d1          d2
      // Omega0 ---> Omega1 ---> Omega2 ---> Omega3
      const d1d0 = d1.matmulCsr(d0)
      const d2d1 = d2.matmulCsr(d1)
      assert(d1d0.data.every(v => v === 0)) // d1 . d0 = 0
      assert(d2d1.data.every(v => v === 0)) // d2 . d1 = 0

      // Singular chain
      //      b1      b2      b3
      // C0 <--- C1 <--- C2 <--- C3
      const b3 = d2.transpose()
      const b2 = d1.transpose()
      const b1 = d0.transpose()
      const b2b3 = b2.matmulCsr(b3)
      const b1b2 = b1.matmulCsr(b2)
      assert(b2b3.data.every(v => v === 0)) // b2 . b3 = 0
      assert(b1b2.data.every(v => v === 0)) // b1 . b2 = 0

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      deepCloseTo(c2xc0B.data, [
        0, 2, 1,
        0, 1, 3,
        0, 3, 2,
        1, 2, 3
      ])
    })

    it('works 1', () => {
      const c3xc0 = Matrix.empty([2, 4], Uint32Array)
      c3xc0.data.set([
        0, 1, 2, 3,
        1, 2, 3, 4
      ])
      const nC0 = 5
      const nC3 = c3xc0.shape[0]

      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0)
      const nC2 = c2xc0.shape[0]

      const { c1xc0, d1 } = ddg.computeD1(c2xc0, nC0, false)
      const nC1 = c1xc0.shape[0]

      const { d0 } = ddg.computeD0(c1xc0, nC0)

      deepCloseTo([nC0, nC1, nC2, nC3], [5, 9, 7, 2])
      deepCloseTo(nC0 - nC1 + nC2 - nC3, 1) // Euler characteristics

      deepCloseTo(c2xc0.shape, [nC2, 3])
      deepCloseTo(c1xc0.shape, [nC1, 2])
      deepCloseTo(d2.shape, [nC3, nC2])
      deepCloseTo(d1.shape, [nC2, nC1])
      deepCloseTo(d0.shape, [nC1, nC0])

      deepCloseTo(c2xc0.data, [
        0, 1, 2,
        0, 1, 3,
        0, 2, 3,
        1, 2, 3,
        1, 2, 4,
        1, 3, 4,
        2, 3, 4
      ])
      deepCloseTo(d2.toDense().data, [
        -1, 1, -1, 1, 0, 0, 0,
        0, 0, 0, -1, 1, -1, 1
      ])

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      deepCloseTo(c2xc0B.data, [
        0, 2, 1,
        0, 1, 3,
        0, 3, 2,
        1, 2, 4,
        1, 4, 3,
        2, 3, 4
      ])
    })

    it('works 2', async () => {
      const data = await readFile('misc/data/bunny.off.tetwild.1e-2.mesh')
      const { verts, c3xc0 } = readMESH(data)
      const nC0 = verts.shape[0]
      const nC3 = c3xc0.shape[0]

      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0)
      const nC2 = c2xc0.shape[0]

      const { c1xc0, d1 } = ddg.computeD1(c2xc0, nC0, false)
      const nC1 = c1xc0.shape[0]

      const { d0 } = ddg.computeD0(c1xc0, nC0)

      deepCloseTo([nC0, nC1, nC2, nC3], [1167, 6474, 9937, 4629])
      equal(nC0 - nC1 + nC2 - nC3, 1)

      deepCloseTo(c2xc0.shape, [nC2, 3])
      deepCloseTo(c1xc0.shape, [nC1, 2])
      deepCloseTo(d2.shape, [nC3, nC2])
      deepCloseTo(d1.shape, [nC2, nC1])
      deepCloseTo(d0.shape, [nC1, nC0])

      // d.d = 0
      const d1d0 = d1.matmulCsr(d0)
      const d2d1 = d2.matmulCsr(d1)
      assert(d1d0.data.every(v => v === 0))
      assert(!d2d1.data.every(v => v === 0)) // TODO: probably there's still a bug in computeD2 or computeD1

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      deepCloseTo(c2xc0B.shape, [1358, 3])
    })

    it('works 3', async () => {
      // NOTE: this libigl's data seems like convex hull of bunny (cf. ex13_inspector)
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.mesh')
      const { verts, c3xc0 } = readMESH(data)
      const nC0 = verts.shape[0]
      const nC3 = c3xc0.shape[0]

      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0) // eslint-disable-line
      const nC2 = c2xc0.shape[0]

      const { c1xc0, d1 } = ddg.computeD1(c2xc0, nC0, false) // eslint-disable-line
      const nC1 = c1xc0.shape[0]

      const { d0 } = ddg.computeD0(c1xc0, nC0) // eslint-disable-line

      deepCloseTo([nC0, nC1, nC2, nC3], [5433, 39822, 68445, 34055])
      deepCloseTo(nC0 - nC1 + nC2 - nC3, 1)

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      deepCloseTo(c2xc0B.shape, [670, 3])
    })
  })

  describe('computeBoundaryLoop', () => {
    it('works', () => {
      const data = fs.readFileSync('thirdparty/libigl-tutorial-data/camelhead.off').toString()
      let { verts, f2v } = readOFF(data, true)
      verts = new Matrix(verts, [verts.length / 3, 3])
      const c2xc0 = new Matrix(f2v, [f2v.length / 3, 3])
      const nC0 = verts.shape[0]
      const { c1xc0, d1 } = ddg.computeD1(c2xc0, nC0, /* checkTwoManiforld */ true)
      const { d0 } = ddg.computeD0(c1xc0, nC0)
      const { c0B, c1B } = ddg.computeBoundaryC2(d0, d1)
      const root = c0B.data.findIndex(v => v !== 0)
      const loop = ddg.computeBoundaryLoop(root, c0B, c1B, c1xc0)
      const nC0B = c0B.data.filter(v => v !== 0).length
      equal(loop.nnz, nC0B - 1)
    })
  })

  describe('HarmonicParametrizationSolver', () => {
    it('works', function () {
      this.timeout(10000)
      const data = fs.readFileSync('thirdparty/libigl-tutorial-data/camelhead.off').toString()
      let { verts, f2v } = readOFF(data, true)
      verts = new Matrix(verts, [verts.length / 3, 3])
      const c2xc0 = new Matrix(f2v, [f2v.length / 3, 3])
      const solver = new ddg.HarmonicParametrizationSolver()
      const { u, v, stats } = solver.compute(verts, c2xc0)
      assert(stats.u.residue < 1e-2)
      assert(stats.v.residue < 1e-2)
      const nC0 = verts.shape[0]
      assert(_.range(nC0).every(i => u.data[i] ** 2 + v.data[i] ** 2 <= 1.01))
    })
  })
})
