/* eslint camelcase: 0, no-unused-vars: 0 */

import _ from '../../web_modules/lodash.js'
import * as glm from './glm.js'

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

// Improved version of Utils.computeTopology
// f2v: int[n, 3]
// nV: int
const computeTopology = (f2v, nV) => {
  const nF = f2v.length

  // Relation from edge to vert [[v0, v1], ...]
  // orientation is encoded implicitly as [(v0, -1), (v1, +1)]
  // (i.e. sparse representation of d_0 : R^V -> R^E)
  const e2v = []

  // Relation from vert to vert/edge [[(v1, e1, +1/-1), (v2, e2, +1/-1), ..], ...]
  // (i.e. transpose of e2v)
  // (i.e. antisymmetric adjacent matrix)
  const v2ve = _.range(nV).map(() => [])

  // Relation from face to ccw edge [[(e0, +1/-1), (e1, ..), (e2, ..)], ...]
  // where +1/-1 represents orientation wrt above e2v orientation
  // (i.e. sparse representation of d_1 : R^E -> R^F)
  const f2e = _.range(nF).map(() => [])

  // Relation from edge to face [[(f0, +1/-1), (f1, +1/-1)], ...]
  // for boundary edge, entry will have only one face
  // (i.e. transpose of f2e)
  const e2f = []

  // Squash f2e and e2f [[[f0, e0, +1/-1], [f1, e1, +1/-2], ..], ...]
  // (i.e. antisymmetric (face) adjacency matrix)
  const f2fe = _.range(nF).map(() => [])

  // TODO: Is this useful?
  // const v2f = _.range(nF).map(() => [])

  // Loop faces
  for (const i of _.range(nF)) {
    for (const j of _.range(3)) {
      const v0 = f2v[i][j]
      const v1 = f2v[i][(j + 1) % 3]
      let veo = v2ve[v0].find(([v, _e, _o]) => v === v1)
      if (!veo) {
        // Register new edge
        const e = e2v.length
        veo = [v1, e, 1]
        v2ve[v0].push([v1, e, 1])
        v2ve[v1].push([v0, e, -1])
        e2v.push([v0, v1])
        e2f[e] = []
      }
      const [_v, e, o] = veo
      f2e[i][j] = [e, o]
      e2f[e].push([i, o])
    }
  }

  // 2nd loop to get f2fe
  for (const i of _.range(nF)) {
    for (const [e, o] of f2e[i]) {
      for (const [j, _o] of e2f[e]) {
        if (i !== j) {
          f2fe[i].push([j, e, o])
        }
      }
    }
  }

  return { e2v, v2ve, f2e, e2f, f2fe }
}

// verts: float[nV, 3] (vertex position in R^3)
// f2v: int[nF, 3]
// topology: result from computeTopology
const computeMore = (verts, f2v, topology) => {
  const nV = verts.length
  const nF = f2v.length
  const { e2v, f2e } = topology
  const nE = e2v.length

  // float[nE, 3] (edge vector in R^3)
  const edges = _.range(nE)

  // float[nE] (primal 1-form to dual 1-form)
  const hodge1 = _.range(nE).fill(0)

  // float[nV] (primal 0-form to dual 2-form) (i.e. area of dual face)
  const hodge0 = _.range(nV).fill(0)

  // float[nV]
  const angleSum = _.range(nV).fill(0)

  // Loop edges
  for (const i of _.range(nE)) {
    const [v0, v1] = e2v[i]
    edges[i] = sub(verts[v1], verts[v0])
  }

  // Loop faces
  for (const i of _.range(nF)) {
    for (const j of _.range(3)) {
      const [e0, o0] = f2e[i][(j + 0) % 3]
      const [e1, o1] = f2e[i][(j + 1) % 3]
      const [e2, o2] = f2e[i][(j + 2) % 3]

      const u0 = mul(o0, edges[e0])
      const u2 = mul(o2, edges[e2])
      const u0u2_cosA = -dot(u0, u2)
      const u0u2_sinA = length(cross(u0, u2))
      hodge1[e1] += 0.5 * u0u2_cosA / u0u2_sinA // |u0| * |u2| cancels

      const v0 = f2v[i][j]
      const A = acos(u0u2_cosA / sqrt(dot2(u0) * dot2(u2)))
      angleSum[v0] += abs(A)
    }
  }

  // Loop edges
  for (const i of _.range(nE)) {
    const [v0, v1] = e2v[i]

    // area which contributes to dual face
    //   = (1 / 2) * (1 / 2) * |prim-e| * |dual-e|
    //   = (1 / 4) * |prim-e| * |prim-3| * hodge1(prim-e)
    const h = hodge1[i]
    const l = length(edges[i])
    const area = 0.25 * l * l * h

    hodge0[v0] += area
    hodge0[v1] += area
  }

  return { angleSum, hodge0, hodge1 }
}

const computeLaplacian = (nV, e2v, hodge1) => {
  const nE = e2v.length

  // Laplacian = - d0^T . hodge1 . d0  (dual 2 form)
  // sparse float[nV, nV]
  const L = _.range(nV).map(() => new Map())

  const increment = (map, key, value) => {
    map.set(key, (map.has(key) ? map.get(key) : 0) + value)
  }

  for (const i of _.range(nE)) {
    const [v0, v1] = e2v[i]
    const h = hodge1[i]
    increment(L[v0], v0, -h)
    increment(L[v1], v1, -h)
    increment(L[v0], v1, h)
    increment(L[v1], v0, h)
  }

  return L
}

const computeMeanCurvature = (verts, L) => {
  const nV = verts.length

  // Laplacian of position (2HN = Δf)
  // this is dual 2-form, so it should be divided by hodge0 to get primal 0-form
  // float[nV, 3]
  const HN2 = _.range(nV).map(() => [0, 0, 0])

  // Sparse matrix multiplication
  for (const i of _.range(nV)) {
    for (const [j, u] of L[i]) {
      HN2[i] = add(HN2[i], mul(u, verts[j]))
    }
  }

  return HN2
}

export {
  computeTopology, computeMore, computeLaplacian, computeMeanCurvature
}
