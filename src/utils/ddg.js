/* eslint camelcase: 0, no-unused-vars: 0 */

import _ from '../../web_modules/lodash.js'
import * as glm from './glm.js'
import { Matrix, MatrixCOO } from './array.js'

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
// (this works for non-triangle mesh as well)
const computeTopology = (f2v, nV) => {
  const nF = f2v.length

  // Relation from edge to vert [[v0, v1], ...]
  // orientation is encoded implicitly as [(v0, -1), (v1, +1)]
  // (i.e. sparse representation of d_0 : R^V -> R^E)
  // (TODO: make it same format as dual conterpart `e2f`)
  const e2v = []

  // Relation from vert to vert/edge [[(v1, e1, +1/-1), (v2, e2, +1/-1), ..], ...]
  // (i.e. transpose of e2v)
  // (i.e. antisymmetric adjacent matrix)
  const v2ve = _.range(nV).map(() => [])

  // Relation from face to ccw edge [[(e0, +1/-1), (e1, ..), ..], ...]
  // where +1/-1 represents orientation wrt above e2v orientation
  // (i.e. sparse representation of d_1 : R^E -> R^F)
  const f2e = _.range(nF).map(() => [])

  // Relation from edge to face [[(f0, +1/-1), (f1, +1/-1)], ...]
  // for boundary edge, entry will have only one face
  // (i.e. transpose of f2e)
  const e2f = []

  // Squash f2e and e2f [[[f0, e0, +1/-1], [f1, e1, +1/-1], ..], ...]
  // (i.e. antisymmetric (face) adjacency matrix)
  // (TODO: make separate function for computing this since it's only used for `computeTreeCotree`)
  const f2fe = _.range(nF).map(() => [])

  // TODO: Is this useful?
  // const v2f = _.range(nF).map(() => [])

  // Loop faces
  for (const i of _.range(nF)) {
    const n = f2v[i].length
    for (const j of _.range(n)) {
      const v0 = f2v[i][j]
      const v1 = f2v[i][(j + 1) % n]
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
    //   = (1 / 4) * |prim-e| * |prim-e| * hodge1(prim-e)
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

  // Laplacian = - d0^T . hodge1 . d0 (linear operator: primal 0 form => dual 2 form)
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

// verts: float[nV, 3]
// f2v: uint[nF, 3]
const computeLaplacianV2 = (verts, f2v) => {
  const nV = verts.shape[0]
  const nF = f2v.shape[0]
  const nnzReserve = 3 * 4 * nF
  const L = MatrixCOO.empty([nV, nV], nnzReserve)

  const { cross } = glm
  const { subeq, dot, length, clone } = glm.v3

  for (let i = 0; i < nF; i++) {
    // Make edge vector
    const vs = f2v.row(i)
    const ps = _.range(3).map(j => verts.row(vs[j]))
    const qs = _.range(3).map(j => subeq(clone(ps[(j + 1) % 3]), ps[j]))

    // Compute cotan for each angle and update sparse entry
    for (let j = 0; j < 3; j++) {
      const j1 = (j + 1) % 3
      const j2 = (j + 2) % 3
      const v1 = vs[j1]
      const v2 = vs[j2]
      const q0 = qs[j]
      const q2 = qs[j2]
      const hodge = -0.5 * dot(q0, q2) / length(cross(q0, q2))
      L.set(v1, v1, -hodge)
      L.set(v2, v2, -hodge)
      L.set(v1, v2, hodge)
      L.set(v2, v1, hodge)
    }
  }
  return L
}

// Almost same as `computeLaplacianV2` but compute `hodge0` and `kg` within same loop
const computeMoreV2 = (verts, f2v) => {
  const nV = verts.shape[0]
  const nF = f2v.shape[0]
  const nnzReserve = 3 * 4 * nF
  const laplacian = MatrixCOO.empty([nV, nV], nnzReserve)
  const hodge0 = Matrix.empty([nV, 1])
  const kg = Matrix.empty([nV, 1])
  kg.data.fill(2 * PI)

  const { cross } = glm
  const { subeq, dot, dot2, length, clone } = glm.v3
  const { acos, sqrt, abs } = Math

  for (let i = 0; i < nF; i++) {
    // Make edge vector
    const vs = f2v.row(i)
    const ps = [verts.row(vs[0]), verts.row(vs[1]), verts.row(vs[2])]
    const qs = [
      subeq(clone(ps[1]), ps[0]),
      subeq(clone(ps[2]), ps[1]),
      subeq(clone(ps[0]), ps[2])
    ]
    const ls = [length(qs[0]), length(qs[1]), length(qs[2])]

    // Compute each angle
    for (let j = 0; j < 3; j++) {
      const j1 = (j + 1) % 3
      const j2 = (j + 2) % 3
      const v1 = vs[j1]
      const v2 = vs[j2]
      const q0 = qs[j]
      const q2 = qs[j2]

      // Cotan laplacian
      const cosx = -dot(q0, q2)
      const cotan = 0.5 * cosx / length(cross(q0, q2))
      laplacian.set(v1, v1, -cotan)
      laplacian.set(v2, v2, -cotan)
      laplacian.set(v1, v2, cotan)
      laplacian.set(v2, v1, cotan)

      // Angle defect
      const x = acos(cosx / (ls[j] * ls[j2]))
      kg.incr(vs[j], 0, -abs(x))

      // Dual face area
      // (1/2) * (1/2) * |prim-e| * |dual-e|
      // = 1/4 * |prim-e| * (|prim-e| * this-cotan + |prim-e| * other-cotan)
      const area = 0.25 * ls[j1] * ls[j1] * cotan
      hodge0.incr(v1, 0, area)
      hodge0.incr(v2, 0, area)
    }
  }

  return { laplacian, hodge0, kg }
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

const matmul = (y, A, x) => {
  for (let i = 0; i < x.length; i++) {
    y[i] = 0
    for (const [j, u] of A[i]) {
      y[i] += u * x[j]
    }
  }
}

const transposeVerts = (verts) => {
  const nV = verts.length
  const result = []
  for (const i of _.range(3)) {
    const a = new Float32Array(nV)
    for (const j of _.range(nV)) {
      a[j] = verts[j][i]
    }
    result.push(a)
  }
  return result
}

const computeMeanCurvatureV2 = (vertsT, L) => {
  const nV = vertsT[0].length
  const result = _.range(3).map(() => new Float32Array(nV))
  for (const i of _.range(3)) {
    matmul(result[i], L, vertsT[i])
  }
  return result
}

// this also works for `f2fe` to make dual spanning tree
const computeSpanningTree = (root, v2ve) => {
  const nV = v2ve.length

  // Subset of v2ve to make spanning tree edges
  const tree = _.range(nV).map(() => [])

  // Simple BFS (only traverses the connected component with root)
  const visited = _.range(nV).fill(false)
  const queue = []
  queue.push(root)
  visited[root] = true
  while (queue.length > 0) {
    const v1 = queue.shift() // "queue.pop()" makes it almost DFS
    for (const [v2, e, o] of v2ve[v1]) {
      if (visited[v2]) { continue }

      visited[v2] = true
      tree[v1].push([v2, e, o])
      queue.push(v2)
    }
  }

  return tree
}

// Avoid `invalidEdges` and return `usedEdges` for the use of `computeTreeCotree`
const computeSpanningTreeV2 = (root, v2ve, nE, invalidEdges = null) => {
  const nV = v2ve.length

  // Subset of v2ve to make spanning tree edges
  const tree = _.range(nV).map(() => ({ parent: null, children: [] }))
  const usedEdges = _.range(nE).fill(false)

  // Simple BFS (only traverses the connected component with root)
  // TODO: it might be that DFS's "tree-cotree" has nicer property?
  const visited = _.range(nV).fill(false)
  const queue = []
  queue.push(root)
  visited[root] = true
  while (queue.length > 0) {
    const v1 = queue.shift() // "queue.pop()" makes it almost DFS
    for (const [v2, e, o] of v2ve[v1]) {
      if (visited[v2]) { continue }
      if (invalidEdges && invalidEdges[e]) { continue }

      visited[v2] = true
      usedEdges[e] = true
      tree[v1].children.push([v2, e, o])
      tree[v2].parent = [v1, e, o]
      queue.push(v2)
    }
  }

  return { tree, usedEdges }
}

const computePathToRoot = (v0, tree) => {
  let v = v0
  const path = []
  while (tree[v].parent) {
    const veo = tree[v].parent
    path.push(veo[1])
    v = veo[0]
  }
  return path
}

const computeLoop = (e, treeF, e2f) => {
  const [[f1, o1], [f2, o2]] = e2f[e]
  const path1 = computePathToRoot(f1, treeF)
  const path2 = computePathToRoot(f2, treeF)
  const loop = [...path1.reverse(), e, ...path2]
  return loop
}

// Prop. loops are homology generators
//  0. Assume surface is 2dim-connected-closed manifold
//  1. Writing
//    V, E, F: number of primal mesh vertices/edges/faces
//    V*, E*, F*: number of dual mesh vertices/edges/faces (V* = F, E* = E, F* = V)
//    Vt, Et: number of tree vertices/edges
//    Vt*, Et*: number of cotree vertices/edges
//  2. Since connected, we have
//    Vt = V and thus Et = Vt - 1 = V - 1
//    Vt* = V* and thus Et* = Vt* - 1 = V* - 1 = F - 1
//  3. Thus
//    Et + Et* = V + F - 2
//    E - (Et + Et*) = 2 - (V - E + F) = 2 - X = 2g
//    So we found 2g loops.
//  4. By construction, they are not contractible (i.e. doesn't disconnect surface)
//     Moreover, any linear combination of the loops are not contractible by the same argument.
//     Therefore, these 2g loops have to span Homology group (which is known to have 2g generators)
// NOTE:
// - This is actual "cotree-tree" construction.
//   If we want "tree-cotree", then just pass its dual
const computeTreeCotree = (rootV, rootF, v2ve, f2fe, e2f) => {
  const nE = e2f.length
  const { tree: treeF, usedEdges: edgesF } = computeSpanningTreeV2(rootF, f2fe, nE)
  const { tree: treeV, usedEdges: edgesV } = computeSpanningTreeV2(rootV, v2ve, nE, edgesF)
  const edgesFree = _.range(nE).filter(e => !edgesV[e] && !edgesF[e])
  const loops = edgesFree.map(e => computeLoop(e, treeF, e2f))
  return { treeF, treeV, edgesF, edgesV, edgesFree, loops }
}

// NOTE: not used now (cf ex18_poisson_equation)
// Solve (biased) linear system (A + hI) x = b by Gauss-Seidel
// NOTE:
// - If A is weak-diag-dominant, then A + h I is strict-diag-dominant,
//   and thus, Gauss-Seidel converges.
// - If (A + hI) x = b, then we have residue |A x - b| = h |x|
// TODO:
// - Check convergence
// - Implement Cholesky decomposition for real positive definite
// - Adopt MatrixCSR.stepGaussSeidel
const solveGaussSeidel = (A, x0, b, h, N) => {
  const nV = x0.length
  const x = _.cloneDeep(x0)
  for (const n of _.range(N)) { //eslint-disable-line
    for (const i of _.range(nV)) {
      let diag = 0
      let rhs = b[i]
      for (const [j, a] of A[i]) {
        if (j === i) {
          diag = a + h
          continue
        }
        rhs -= a * x[j]
      }
      x[i] = rhs / diag
    }
  }
  return x
}

const negateSparse = (L) => {
  const nV = L.length
  const L_neg = _.range(nV).map(() => new Map())
  for (const i of _.range(nV)) {
    for (const [k, v] of L[i]) {
      L_neg[i].set(k, -v)
    }
  }
  return L_neg
}

// NOTE: not used now (cf ex18_poisson_equation)
const solvePoisson = (verts, f2v, rho_dual) => {
  const nV = verts.length
  const topology = computeTopology(f2v, nV)
  const more = computeMore(verts, f2v, topology)
  const L = computeLaplacian(nV, topology.e2v, more.hodge1)

  // Make it weak-diag-dominant by negation
  const L_neg = negateSparse(L)
  const rho_dual_neg = rho_dual.map(v => -v)

  // Solve (equating (integrated) dual 2-form)
  const u0_neg = rho_dual_neg
  const u_neg = solveGaussSeidel(L_neg, u0_neg, rho_dual_neg, 1e-6, 20)

  // Since KerL = span((1, 1, ...)), we remove that component
  // Also negate back to what we want
  const avg = _.sum(u_neg) / nV
  const u = u_neg.map(v => -(v - avg))

  return u
}

export {
  computeTopology, computeMore, computeLaplacian, computeMeanCurvature,
  computeSpanningTree, computeSpanningTreeV2, computeTreeCotree,
  solvePoisson, solveGaussSeidel,
  matmul, transposeVerts, computeMeanCurvatureV2,
  computeLaplacianV2, computeMoreV2
}
