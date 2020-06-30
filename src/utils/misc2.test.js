/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import * as misc2 from './misc2.js'
import * as ddg from './ddg.js'
import * as glm from './glm.js'
import { Matrix } from './array.js'
import { equal, deepEqual, deepCloseTo } from './test-misc.js'

describe('misc2', () => {
  describe('makeTriangle', () => {
    it('works 0', () => {
      const { verts, f2v } = misc2.makeTriangle(4)
      deepEqual(verts.shape, [15, 3])
      deepEqual(f2v.shape, [16, 3])
    })

    it('works 1', () => {
      const { verts, f2v } = misc2.makeTriangle(2)
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

  describe('sort3', () => {
    it('works 0', () => {
      const a = [0, 1, 2]
      deepEqual(misc2.sort3(0, 1, 2), a)
      deepEqual(misc2.sort3(0, 2, 1), a)
      deepEqual(misc2.sort3(1, 0, 2), a)
      deepEqual(misc2.sort3(1, 2, 0), a)
      deepEqual(misc2.sort3(2, 0, 1), a)
      deepEqual(misc2.sort3(2, 1, 0), a)
    })

    it('works 1', () => {
      deepEqual(misc2.sortParity3(0, 1, 2), [0, 1, 2, 1])
      deepEqual(misc2.sortParity3(0, 2, 1), [0, 1, 2, -1])
      deepEqual(misc2.sortParity3(1, 0, 2), [0, 1, 2, -1])
      deepEqual(misc2.sortParity3(1, 2, 0), [0, 1, 2, 1])
      deepEqual(misc2.sortParity3(2, 0, 1), [0, 1, 2, 1])
      deepEqual(misc2.sortParity3(2, 1, 0), [0, 1, 2, -1])
    })
  })

  describe('makeTetrahedralizedCube', () => {
    it('works 0', () => {
      const { verts, c3xc0 } = misc2.makeTetrahedralizedCube(1)
      const nC0 = verts.shape[0]
      const nC3 = c3xc0.shape[0]

      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0)
      const nC2 = c2xc0.shape[0]

      const { c1xc0 } = ddg.computeD1(c2xc0, nC0, false)
      const nC1 = c1xc0.shape[0]

      deepEqual([nC0, nC1, nC2, nC3], [
        8, // cube vertices
        12 + 6 + 1, // (original cube edge) + (face cuts) + (diagonal)
        2 * 6 + 2 * 3, // (triangulated cube faces) + (triangulated diagonal planes)
        6 // tetrahedrize 6 patterns of x < y < z
      ])
      equal(nC0 - nC1 + nC2 - nC3, 1)

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      const nC2B = c2xc0B.shape[0]
      equal(nC2B, 12) // triangulated cube faces

      // Check signed volume of tetrahedra
      const { sub } = glm.vec3
      const { det } = glm.mat3
      for (let i = 0; i < nC3; i++) {
        const vs = c3xc0.row(i)
        const u1 = sub(verts.row(vs[1]), verts.row(vs[0]))
        const u2 = sub(verts.row(vs[2]), verts.row(vs[0]))
        const u3 = sub(verts.row(vs[3]), verts.row(vs[0]))
        const T = [...u1, ...u2, ...u3]
        equal(det(T), 1)
      }
    })

    it('works 1', () => {
      const { verts, c3xc0 } = misc2.makeTetrahedralizedCube(2)
      const nC0 = verts.shape[0]
      const nC3 = c3xc0.shape[0]
      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0)
      const nC2 = c2xc0.shape[0]
      const { c1xc0 } = ddg.computeD1(c2xc0, nC0, false)
      const nC1 = c1xc0.shape[0]
      deepEqual([nC0, nC1, nC2, nC3], [27, 98, 120, 48])
      equal(nC0 - nC1 + nC2 - nC3, 1)

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      const nC2B = c2xc0B.shape[0]
      equal(nC2B, 48)

      // Check signed volume of tetrahedra
      const { sub } = glm.vec3
      const { det } = glm.mat3
      for (let i = 0; i < nC3; i++) {
        const vs = c3xc0.row(i)
        const u1 = sub(verts.row(vs[1]), verts.row(vs[0]))
        const u2 = sub(verts.row(vs[2]), verts.row(vs[0]))
        const u3 = sub(verts.row(vs[3]), verts.row(vs[0]))
        const T = [...u1, ...u2, ...u3]
        equal(det(T), 1 / 8)
      }
    })
  })

  describe('makeTetrahedralizedCubeSymmetric', () => {
    it('works 0', () => {
      const { verts, c3xc0 } = misc2.makeTetrahedralizedCubeSymmetric(1)
      const nC0 = verts.shape[0]
      const nC3 = c3xc0.shape[0]

      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0)
      const nC2 = c2xc0.shape[0]

      const { c1xc0 } = ddg.computeD1(c2xc0, nC0, false)
      const nC1 = c1xc0.shape[0]

      deepEqual([nC0, nC1, nC2, nC3], [
        3 ** 3,
        90,
        104,
        5 * 8 // 5 tetrahedra x octants
      ])
      equal(nC0 - nC1 + nC2 - nC3, 1)

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      const nC2B = c2xc0B.shape[0]
      equal(nC2B, 8 * 6)

      // Check signed volume of tetrahedra
      const { sub } = glm.vec3
      const { det } = glm.mat3
      for (let i = 0; i < nC3; i++) {
        const vs = c3xc0.row(i)
        const u1 = sub(verts.row(vs[1]), verts.row(vs[0]))
        const u2 = sub(verts.row(vs[2]), verts.row(vs[0]))
        const u3 = sub(verts.row(vs[3]), verts.row(vs[0]))
        const T = [...u1, ...u2, ...u3]
        assert(det(T) > 0)
      }
    })

    it('works 1', () => {
      const { verts, c3xc0 } = misc2.makeTetrahedralizedCubeSymmetric(4)
      const nC0 = verts.shape[0]
      const nC3 = c3xc0.shape[0]
      const { c2xc0, d2 } = ddg.computeD2(c3xc0, nC0)
      const nC2 = c2xc0.shape[0]
      const { c1xc0 } = ddg.computeD1(c2xc0, nC0, false)
      const nC1 = c1xc0.shape[0]
      deepEqual([nC0, nC1, nC2, nC3], [729, 3672, 5504, 2560])
      equal(nC0 - nC1 + nC2 - nC3, 1)

      const c2xc0B = ddg.computeBoundary(c2xc0, d2)
      const nC2B = c2xc0B.shape[0]
      equal(nC2B, 768)

      // Check signed volume of tetrahedra
      const { sub } = glm.vec3
      const { det } = glm.mat3
      for (let i = 0; i < nC3; i++) {
        const vs = c3xc0.row(i)
        const u1 = sub(verts.row(vs[1]), verts.row(vs[0]))
        const u2 = sub(verts.row(vs[2]), verts.row(vs[0]))
        const u3 = sub(verts.row(vs[3]), verts.row(vs[0]))
        const T = [...u1, ...u2, ...u3]
        assert(det(T) > 0)
      }
    })
  })

  describe('circumsphere', () => {
    it('works 0', () => {
      const p0 = [1, 1, 1]
      const p1 = [0, 0, 1]
      const p2 = [0, 1, 0]
      const p3 = [1, 0, 0]
      const c = misc2.circumsphere(p0, p1, p2, p3)
      deepCloseTo(c, [0.5, 0.5, 0.5])
    })
  })

  describe('delaunayBruteforce', () => {
    it('works 0', () => {
      const verts = Matrix.empty([5, 3])
      verts.data.set([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
        1, 1, -1
      ])
      const c3xc0 = misc2.delaunayBruteforce(verts)
      deepCloseTo(c3xc0.data, [
        0, 1, 2, 3,
        0, 1, 4, 2
      ])

      const { c2xc0 } = ddg.computeD2(c3xc0, verts.shape[0])
      deepCloseTo(c2xc0.data, [
        0, 1, 2,
        0, 1, 3,
        0, 1, 4,
        0, 2, 3,
        0, 2, 4,
        1, 2, 3,
        1, 2, 4
      ])
    })

    it('works 1', () => {
      const verts = Matrix.empty([5, 3])
      verts.data.set([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
        1 / 4, 1 / 4, 1 / 4
      ])
      const c3xc0 = misc2.delaunayBruteforce(verts)
      deepCloseTo(c3xc0.data, [
        0, 1, 2, 4,
        0, 1, 4, 3,
        0, 2, 3, 4,
        1, 2, 4, 3
      ])
    })
  })

  describe('binom', () => {
    it('works 0', () => {
      const b = misc2.binom(5, 2)
      deepEqual(b.data, new Uint32Array([
        0, 1,
        0, 2,
        1, 2,
        0, 3,
        1, 3,
        2, 3,
        0, 4,
        1, 4,
        2, 4,
        3, 4
      ]))
    })
  })
})
