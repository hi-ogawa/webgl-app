/* eslint camelcase: 0 */

import _ from '../../web_modules/lodash.js'
import * as glm from './glm.js'
import { Matrix, MatrixCOO, MatrixCSR, TensorCOO, TensorCSR } from './array.js'
import * as misc2 from './misc2.js'

const { PI } = Math

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
      const [_v, e, o] = veo // eslint-disable-line no-unused-vars
      f2e[i][j] = [e, o]
      e2f[e].push([i, o])
    }
  }

  // 2nd loop to get f2fe
  for (const i of _.range(nF)) {
    for (const [e, o] of f2e[i]) {
      for (const [j, _o] of e2f[e]) { // eslint-disable-line no-unused-vars
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

  const { acos, sqrt, abs } = Math
  const { sub, muls, dot, cross, length, dot2 } = glm.vec3

  // Loop edges
  for (const i of _.range(nE)) {
    const [v0, v1] = e2v[i]
    edges[i] = sub(verts[v1], verts[v0])
  }

  // Loop faces
  for (const i of _.range(nF)) {
    for (const j of _.range(3)) {
      const [e0, o0] = f2e[i][(j + 0) % 3]
      const [e1, o1] = f2e[i][(j + 1) % 3] // eslint-disable-line no-unused-vars
      const [e2, o2] = f2e[i][(j + 2) % 3]

      const u0 = muls(edges[e0], o0)
      const u2 = muls(edges[e2], o2)
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

  const { subeq, dot, length, cross, clone } = glm.vec3

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

  const { subeq, dot, length, clone, cross } = glm.vec3
  const { acos, abs } = Math

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

  const { addeq, muls } = glm.vec3

  // Sparse matrix multiplication
  for (const i of _.range(nV)) {
    for (const [j, u] of L[i]) {
      addeq(HN2[i], muls(verts[j], u))
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
  const [[f1, o1], [f2, o2]] = e2f[e] // eslint-disable-line no-unused-vars
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

// Compute d0 and d1 as sparse matrix
// Sparsity is same as laplacian so the performance should be same order as `computeLaplacianV2`
// TODO: prove/disprove that boundary can be computed by "(1, .., 1) d1" (cf. computeD2 and computeBoundary)
const computeTopologyV2 = (f2v, nV) => {
  // Make sparse v2v with the entry is "signed" face for edge (vi, vj)
  // TODO: maybe it's interesting to embed "opposite vertex" data as well,
  //       which can be useful when constructing laplacian.
  const nF = f2v.shape[0]
  const nnzReserve = 3 * nF
  const v2vCoo = MatrixCOO.empty([nV, nV], nnzReserve, Uint32Array)

  const { min, max } = Math

  // Enumerate edge (v0, v1) where orientation is given by v0 < v1
  for (let i = 0; i < nF; i++) {
    const vs = f2v.row(i)
    const v0 = vs[0]
    const v1 = vs[1]
    const v2 = vs[2]
    // Use top bit "0x80000000" to represent orientation
    v2vCoo.set(min(v0, v1), max(v0, v1), i | (v0 < v1 ? 0x80000000 : 0))
    v2vCoo.set(min(v1, v2), max(v1, v2), i | (v1 < v2 ? 0x80000000 : 0))
    v2vCoo.set(min(v2, v0), max(v2, v0), i | (v2 < v0 ? 0x80000000 : 0))
  }

  // Convert to MatrixCSR and sort indices so that duplicated edges are easy to spot
  const v2v = MatrixCSR.fromCOO(v2vCoo)
  const numDups = v2v.sortIndices()
  const nE = v2v.indptr[nV] - numDups

  // Make d0 and d1 (aka e2v and f2e)
  // (By construction, their indices are already sorted)
  const d0 = MatrixCSR.empty([nE, nV], 2 * nE)
  const d1 = MatrixCSR.empty([nF, nE], 3 * nF)

  // Indptr is trivial
  for (let i = 1; i <= nE; i++) {
    d0.indptr[i] = 2 * i
  }

  for (let i = 1; i <= nF; i++) {
    d1.indptr[i] = 3 * i
  }

  // Indices and data (cf. MatrixCSR.sumDuplicates for this type of loop)
  let foundBoundary = false
  const boundaryEdge = new Uint8Array(nE)
  const numBoundaryEdgesPerFace = new Uint32Array(nF)
  {
    const d1Counts = new Uint32Array(nF)
    let eCount = -1
    let p = 0
    for (let v0 = 0; v0 < nV; v0++) { // Loop v2v row
      let dup = -1
      let vPrev = -1
      let ePrev = -1
      let fPrev = -1

      for (; p < v2v.indptr[v0 + 1]; p++) { // Loop v2v col
        const v1 = v2v.indices[p]
        const fo = v2v.data[p]
        const f = fo & 0x7fffffff
        const o = (fo & 0x80000000) ? 1 : -1

        // Register "edge to vertex (d0)"
        if (v1 !== vPrev) {
          eCount++
          d0.indices[2 * eCount] = v0
          d0.indices[2 * eCount + 1] = v1
          d0.data[2 * eCount] = -1
          d0.data[2 * eCount + 1] = 1

          // Check if previous pair (v0 <-> vPrev) had opposite
          if (dup === 0) {
            foundBoundary = true
            boundaryEdge[ePrev] = true
            numBoundaryEdgesPerFace[fPrev]++
          }
          dup = 0
        } else {
          dup++
          if (dup > 2) {
            throw new Error('[computeD2] More than 2 faces share single edge')
          }
        }

        // Register "face to edge (d1)"
        d1.indices[d1.indptr[f] + d1Counts[f]] = eCount
        d1.data[d1.indptr[f] + d1Counts[f]] = o
        d1Counts[f]++

        vPrev = v1
        ePrev = eCount
        fPrev = f
      }

      // Check if previous pair (v0 <-> vPrev) had opposite
      if (dup === 0) {
        foundBoundary = true
        boundaryEdge[ePrev] = true
        numBoundaryEdgesPerFace[fPrev]++
      }
    }
  }

  return { d0, d1, foundBoundary, boundaryEdge, numBoundaryEdgesPerFace }
}

const computeHodge1 = (verts, f2v, d0, d1) => {
  const nF = f2v.shape[0]
  const nE = d1.shape[1]
  const hodge1 = Matrix.empty([nE, 1])

  const { length, cross, dot } = glm.vec3 // eslint-disable-line no-unused-vars

  // Make edge vectors = d0 . p
  const edges = Matrix.empty([nE, 3])
  d0.matmul(edges, verts)

  // Compute cotan
  for (let i = 0; i < nF; i++) {
    const e0 = d1.indices[3 * i]
    const e1 = d1.indices[3 * i + 1]
    const e2 = d1.indices[3 * i + 2]
    const o0 = d1.data[3 * i]
    const o1 = d1.data[3 * i + 1]
    const o2 = d1.data[3 * i + 2]
    const v0 = edges.row(e0)
    const v1 = edges.row(e1)
    const v2 = edges.row(e2)
    // Unfortunately, inlining is huge win...
    // const d01 = dot(v0, v1)
    // const d12 = dot(v1, v2)
    // const d20 = dot(v2, v0)
    const d01 = v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]
    const d12 = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
    const d20 = v2[0] * v0[0] + v2[1] * v0[1] + v2[2] * v0[2]
    const lc01 = length(cross(v0, v1))
    const lc12 = length(cross(v1, v2))
    const lc20 = length(cross(v2, v0))

    // NOTE:
    // We don't know the order of (e0, e1, e2) making face,
    // but, we can get the sign correctly by always applying "-1".
    hodge1.data[e0] -= o1 * o2 * 0.5 * d12 / lc12
    hodge1.data[e1] -= o2 * o0 * 0.5 * d20 / lc20
    hodge1.data[e2] -= o0 * o1 * 0.5 * d01 / lc01
  }

  return { edges, hodge1 }
}

const computeF2f = (d1) => {
  // Transpose
  let d1T = d1.clone()
  d1T.shape.reverse()
  d1T = MatrixCSR.fromCOO(MatrixCOO.fromCSC(d1T))

  // Make sparse f2f with "signed" edge as the data (in order to handle "0", we offset all by "1")
  const nF = d1.shape[0]
  const nnzReserve = 3 * nF
  const f2fCoo = MatrixCOO.empty([nF, nF], nnzReserve, Int32Array)

  // Loop dual edges
  const nE = d1T.shape[0]
  for (let i = 0; i < nE; i++) {
    const p0 = d1T.indptr[i]
    const p1 = d1T.indptr[i + 1]

    // Skip boundary
    if (p1 !== p0 + 2) { continue }

    const f0 = d1T.indices[p0]
    const f1 = d1T.indices[p0 + 1]
    const o = d1T.data[p0]
    f2fCoo.set(f0, f1, o * (i + 1)) // offset by 1 so that 0-th edge can be "signed"
    f2fCoo.set(f1, f0, -o * (i + 1))
  }

  // Return CSR
  return MatrixCSR.fromCOO(f2fCoo)
}

// v2v: Undirected graph as square MatrixCSR (only v2v.indices is used for traversal)
// NOTE: this returns MatrixCOO and conviniently
//       its row/col/data is ordered as topological sorting of the tree
const computeSpanningTreeV3 = (root, v2v) => {
  const nV = v2v.shape[0]
  if (!(root >= 0 && root < nV)) { throw new Error('[computeSpanningTreeV3]') }

  // Subset of v2v
  const nnzReserve = nV - 1
  const tree = MatrixCOO.empty([nV, nV], nnzReserve, v2v.data.constructor)

  // DFS (traverse only the connected component with root)
  const stacked = new Uint8Array(nV)
  const stack = new Uint32Array(nV)
  let stackp = 0
  stack[stackp++] = root
  stacked[root] = true
  while (stackp > 0) {
    const v0 = stack[--stackp]
    for (let p = v2v.indptr[v0]; p < v2v.indptr[v0 + 1]; p++) {
      const v1 = v2v.indices[p]
      if (stacked[v1]) { continue }

      stack[stackp++] = v1
      stacked[v1] = true
      tree.set(v0, v1, v2v.data[p]) // Copy data
    }
  }

  return tree
}

const computeFaceNormals = (verts, f2v) => {
  const nF = f2v.shape[0]
  const normals = Matrix.empty([nF, 3])

  const { subeq, clone, cross, normalizeeq } = glm.vec3

  for (let i = 0; i < nF; i++) {
    const vs = f2v.row(i)
    const p0 = verts.row(vs[0])
    const p1 = verts.row(vs[1])
    const p2 = verts.row(vs[2])
    const u1 = subeq(clone(p1), p0)
    const u2 = subeq(clone(p2), p0)
    normals.row(i).set(normalizeeq(cross(u1, u2)))
  }
  return normals
}

const computeFaceCentroids = (verts, f2v) => {
  const nF = f2v.shape[0]
  const centers = Matrix.empty([nF, 3])
  const { add, addeq, diveqs } = glm.vec3
  for (let i = 0; i < nF; i++) {
    const vs = f2v.row(i)
    const p0 = verts.row(vs[0])
    const p1 = verts.row(vs[1])
    const p2 = verts.row(vs[2])
    centers.row(i).set(diveqs(addeq(add(p0, p1), p2), 3))
  }
  return centers
}

class VectorFieldSolver {
  //
  // TODO:
  // - Support genus != 0
  //
  // Cf. Crane's DDG course note 8.3 http://www.cs.cmu.edu/~kmcrane/Projects/DDG/paper.pdf
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
  // - (Convention)
  //   - CCW dual edge (thus dual(d1) = - d0^T, dual(d2) = d1^T)
  //
  // - Input
  //   - verts: float[nV, 3]
  //   - f2v: int[nF, 3]
  //   - singularity: int[nV, 1] (Singularity index on dual face s.t. \sum_i s_i = \Kai = 2 - 2g))
  //   - initFace: Root face from which we start parallel-transport initial vector
  //   - initAngle: Initial vector direction on initFace (where frame with x = p1 - p0, z = n)
  //
  // - Output
  //   - vectorField: float[nF, 3] (directional field on primal face)
  //   - ... and other bunch constructed on the way
  //
  // - Algorithm
  //   - 1. Construct
  //     - laplacian   (for step 2.1)
  //     - kg          (for step 2.1)
  //     - hodge1      (for step 2.2)
  //     - d0          (for step 2.2)
  //     - edge vector (for step 3.3)
  //     - face normal (for step 3.3)
  //     - f2f         (for step 3.2)
  //
  //   - 2.
  //     - 2.1. Solve "u" s.t. L u = b = - kg + 2pi s
  //     - 2.2. phi = hodge1 d0 u (connection angle)
  //
  //   - 3.
  //     - 3.1. Define v0 initial unit vector on initFace
  //     - 3.2. Construct spanning tree F_T with root initFace
  //     - 3.3. Extend vector field by parallel-transport based on phi along tree F_T
  //

  compute1 (verts, f2v) {
    const nV = verts.shape[0]
    const nF = f2v.shape[0]

    let { laplacian, kg } = computeMoreV2(verts, f2v)
    laplacian = MatrixCSR.fromCOO(laplacian)
    laplacian.sumDuplicates()
    const laplacianNeg = laplacian.negadddiags(1e-3) // = - L + h I (positive definite)

    const { d0, d1 } = computeTopologyV2(f2v, nV)
    const { hodge1, edges } = computeHodge1(verts, f2v, d0, d1)
    const normals = computeFaceNormals(verts, f2v)
    const f2f = computeF2f(d1)

    _.assign(this, {
      verts, f2v, nV, nF, laplacianNeg, kg, d0, d1, hodge1, edges, normals, f2f
    })
  }

  compute2 (singularity, iterLim = 1024, residueLim = 1e-3) {
    const { laplacianNeg, hodge1, d0, kg } = this

    // 2.1.
    const u = Matrix.emptyLike(singularity)
    const b = singularity.clone().muleqs(2 * PI).subeq(kg)
    const bNeg = b.muleqs(-1)
    const tmp = u.clone()

    let residue = 0
    for (let i = 0; i < iterLim; i++) {
      laplacianNeg.stepGaussSeidel(u, bNeg)
      if (i % 32 === 0) {
        residue = laplacianNeg.matmul(tmp, u).subeq(bNeg).dotHS2() // TODO: this residue check might be expensive
        if (residue < residueLim) { break }
      }
    }

    // 2.2. phi = hodge1 d0 u
    const phi = Matrix.emptyLike(hodge1)
    d0.matmul(phi, u).muleq(hodge1)

    _.assign(this, {
      singularity, u, phi, residue
    })
  }

  compute3 (initFace, initAngle) {
    const { verts, f2v, nF, f2f, normals, edges, phi } = this

    // Define initial vector
    const initVector = [0, 0, 0]
    {
      const { cos, sin } = Math
      const { sub, normalize, assign, matmul } = glm.vec3
      const { frameXZ } = glm.mat3
      const p0 = verts.row(f2v.row(initFace)[0])
      const p1 = verts.row(f2v.row(initFace)[1])
      const x = normalize(sub(p1, p0))
      const z = normals.row(initFace)
      assign(initVector, matmul(frameXZ(x, z), [cos(initAngle), sin(initAngle), 0]))
    }

    // Spanning tree
    const tree = computeSpanningTreeV3(initFace, f2f) // MatrixCOO with topological sorted entries (TODO: maybe it should be BFS for stability)
    const vectorField = Matrix.empty([nF, 3])
    vectorField.row(initFace).set(initVector)

    // Parallel transport
    const { clone, matmuleq, muls, normalizeeq } = glm.vec3
    const { axisAngle, frameXZ, inverse } = glm.mat3

    for (let i = 0; i < tree.nnz; i++) {
      const f0 = tree.row[i]
      const f1 = tree.col[i]
      const eo = tree.data[i] // signed edge
      const e = Math.abs(eo) - 1
      const o = Math.sign(eo)

      const n0 = normals.row(f0)
      const n1 = normals.row(f1)
      const u = normalizeeq(muls(edges.row(e), o))
      const vector0 = vectorField.row(f0)
      const vector1 = clone(vector0)

      // Levi-Civita connection
      const frame0 = frameXZ(u, n0)
      const frame1 = frameXZ(u, n1)
      matmuleq(frame1, matmuleq(inverse(frame0), vector1)) // TODO: find simpler formula

      // Our connection phi (negation "-" comes from our convention of ccw dual edge)
      const angle = -o * phi.data[e]
      matmuleq(axisAngle(n1, angle), vector1)

      vectorField.row(f1).set(vector1)
    }

    _.assign(this, {
      vectorField, tree
    })
  }
}

// Compute d2 of co-chain complex
//   Omega_0 -(d0)-> Omega_1 -(d1)-> Omage_2 -(d2)-> Omega_3
// Then, boundary surface can be obtained by
//   (1, .., 1) d2
const computeD2 = (c3xc0, nC0, checkThreeManifold = true) => { // c3xc0 -> c2xc0 and d2
  // Note that this construction quite nicely parallels to `computeTopologyV2`

  //
  // Enumerate vertex triple with face-orientation from tetrahedron as COO-tensor
  //
  const nC3 = c3xc0.shape[0]
  const nnzReserve = 12 * nC3
  const vvvCoo = TensorCOO.empty([nC0, nC0, nC0], nnzReserve, Int32Array)

  for (let i = 0; i < nC3; i++) {
    const vs = c3xc0.row(i)
    const v0 = vs[0]
    const v1 = vs[1]
    const v2 = vs[2]
    const v3 = vs[3]
    const fo0 = misc2.sortParity3(v0, v2, v1)
    const fo1 = misc2.sortParity3(v0, v3, v2)
    const fo2 = misc2.sortParity3(v0, v1, v3)
    const fo3 = misc2.sortParity3(v1, v2, v3)

    // Encode orientation by sign (but in order to handle "0" we increment original value by "1")
    vvvCoo.set(fo0[0], fo0[1], fo0[2], fo0[3] * (i + 1))
    vvvCoo.set(fo1[0], fo1[1], fo1[2], fo1[3] * (i + 1))
    vvvCoo.set(fo2[0], fo2[1], fo2[2], fo2[3] * (i + 1))
    vvvCoo.set(fo3[0], fo3[1], fo3[2], fo3[3] * (i + 1))
  }

  // Convert to CSR
  const vvv = TensorCSR.fromCOO(vvvCoo)

  // Make d2 (aka c3xc2)
  const nC2 = vvvCoo.nnz - vvv.numDups
  const d2 = MatrixCSR.empty([nC3, nC2], 4 * nC3)

  // Make c2xc0
  const c2xc0 = Matrix.empty([nC2, 3], Uint32Array)

  // d2.indptr is trivial
  for (let i = 1; i <= nC3; i++) {
    d2.indptr[i] = 4 * i
  }

  // c2xc0, d2.indices, d2.data
  {
    const { sign, abs } = Math
    const d2Counts = new Uint32Array(nC3)
    let c2Count = -1
    let p = 0
    for (let v0 = 0; v0 < nC0; v0++) { // Loop vvv ind0
      let v1Prev = -1
      let v2Prev = -1
      let dup = 0

      for (; p < vvv.indptr[v0 + 1]; p++) { // Loop vvv ind1/ind2
        const v1 = vvv.ind1[p]
        const v2 = vvv.ind2[p]
        const c3o = vvv.data[p]
        const c3 = abs(c3o) - 1 // Remember how we enconded 3-cell and orientation
        const o = sign(c3o)

        // [ Debug: see if TensorCSR indices are sorted correctly ]
        // console.log(v0, v1, v2)

        if (v1 === v1Prev && v2 === v2Prev) {
          if (++dup > 2) {
            if (checkThreeManifold) {
              throw new Error('[computeD2] More than 2 tetrahedra share a single face')
            }
          }
        } else {
          // Register "Triangle (2-cell) to Vertex (0-cell)"
          c2xc0.row(++c2Count).set([v0, v1, v2])
          v1Prev = v1
          v2Prev = v2
          dup = 0
        }

        // Register "Tetrahedron (3-cell) to Triangle (2-cell)"
        const q = d2.indptr[c3] + d2Counts[c3]
        d2.indices[q] = c2Count
        d2.data[q] = o
        d2Counts[c3]++
      }
    }
  }

  return { c2xc0, d2 }
}

// c2xc0 -> c1xc0 and d1
// NOTE:
//   Almost same but simplified version of `computeTopologyV2`
//   in order to support c2xc0 obtained from 3-manifold
const computeD1 = (c2xc0, nC0, checkTwoManifold = true) => {
  const nC2 = c2xc0.shape[0]
  const nnzReserve = 3 * nC2
  const vvCoo = MatrixCOO.empty([nC0, nC0], nnzReserve, Int32Array)

  //
  // Enumerate vertex pair with edge-orientation from triangle as COO-matrix
  //

  const { min, max } = Math

  for (let i = 0; i < nC2; i++) {
    const vs = c2xc0.row(i)
    const v0 = vs[0]
    const v1 = vs[1]
    const v2 = vs[2]

    // Encode orientation by sign (but in order to handle "0" we increment original value by "1")
    vvCoo.set(min(v0, v1), max(v0, v1), (v0 < v1 ? 1 : -1) * (i + 1))
    vvCoo.set(min(v1, v2), max(v1, v2), (v1 < v2 ? 1 : -1) * (i + 1))
    vvCoo.set(min(v2, v0), max(v2, v0), (v2 < v0 ? 1 : -1) * (i + 1))
  }

  // Convert to CSR
  const vv = MatrixCSR.fromCOO(vvCoo)
  const numDups = vv.sortIndices()
  const nC1 = vv.indptr[nC0] - numDups

  // Make d1 and c1xc0
  const d1 = MatrixCSR.empty([nC2, nC1], 3 * nC1)
  const c1xc0 = Matrix.empty([nC1, 2], Uint32Array)

  // d1.indptr is trivial
  for (let i = 1; i <= nC2; i++) {
    d1.indptr[i] = 3 * i
  }

  // c1xc0, d1.indices, d1.data
  {
    const { sign, abs } = Math
    const d1Counts = new Uint32Array(nC1)
    let c1Count = -1
    let p = 0
    for (let v0 = 0; v0 < nC0; v0++) { // Loop vv ind0
      let v1Prev = -1
      let dup = 0

      for (; p < vv.indptr[v0 + 1]; p++) { // Loop vv ind1
        const v1 = vv.indices[p]
        const c2o = vv.data[p]
        const c2 = abs(c2o) - 1 // Remember how we enconded 2-cell and orientation
        const o = sign(c2o)

        if (v1 === v1Prev) {
          if (++dup > 2) {
            if (checkTwoManifold) {
              throw new Error('[computeD1] More than 2 triangles share a single edge')
            }
          }
        } else {
          // Register "Edge (1-cell) to Vertex (0-cell)"
          c1xc0.row(++c1Count).set([v0, v1])
          v1Prev = v1
          dup = 0
        }

        // Register "Triangle (2-cell) to Edge (1-cell)"
        const q = d1.indptr[c2] + d1Counts[c2]
        d1.indices[q] = c1Count
        d1.data[q] = o
        d1Counts[c2]++
      }
    }
  }

  return { c1xc0, d1 }
}

// c1xc0 -> d0
const computeD0 = (c1xc0, nC0) => {
  const nC1 = c1xc0.shape[0]
  const d0 = MatrixCSR.empty([nC1, nC0], 2 * nC1)
  d0.indices.set(c1xc0.data)
  for (let i = 0; i < nC1; i++) {
    d0.indptr[i + 1] = 2 * (i + 1)
    d0.data[2 * i + 0] = -1
    d0.data[2 * i + 1] = 1
  }
  return { d0 }
}

// Find surface boundary of tetrahedral mesh (f2v and d2 is from `computeD2`)
// TODO:
// - Probably, we can generalize this to "c{n}xc{0}, d{n} -> boundary c{n}xc{0}"
// - What's happening (co)-homologically? (we get the singular chain by the taking the adjoint of de Rham co-chain?)
//
//           d2
//   Omega2 ----> Omega3
//
//     C2   <----   C3
//           b3
//
const computeBoundary = (f2v, d2) => {
  const [nC3, nF] = d2.shape
  const ones = Matrix.empty([nC3, 1], Int32Array)
  ones.data.fill(1)

  // boundary = (1, .., 1) . d2
  const boundary = Matrix.empty([nF, 1], Int32Array)
  d2.matmulT(boundary, ones)

  const nFB = boundary.data.filter(s => s !== 0).length
  const f2vB = Matrix.empty([nFB, 3], Uint32Array)
  let p = 0
  for (let i = 0; i < nF; i++) {
    const s = boundary.data[i]
    if (s === 0) { continue }

    const vs = f2v.row(i)
    if (s === 1) {
      f2vB.row(p++).set(vs)
      continue
    }
    if (s === -1) {
      f2vB.row(p++).set([vs[0], vs[2], vs[1]])
      continue
    }
    throw new Error('[computeBoundary]')
  }
  return f2vB
}

// Compute oriented 2-cell boundary (simpler version `comoputeBoundary` above. similar spirit to `computeBoundaryC2` below)
const computeBoundaryC3 = (d2) => {
  const [nC3, nC2] = d2.shape
  const ones = Matrix.empty([nC3, 1], Int32Array)
  ones.data.fill(1)

  // c2B = (1, .., 1) . d2
  const c2B = Matrix.empty([nC2, 1], Int32Array)
  d2.matmulT(c2B, ones)

  return { c2B }
}

// Compute 1-cell boundary (oriented) and 0-cell boundary (not oriented)
const computeBoundaryC2 = (d0, d1) => {
  // |b1|. |b2 (1,..,1)^T | = (|(1,..,1) d1^T| |d0|^T)^T
  // where |~| represents point-wise absolute value
  const [nC2, nC1] = d1.shape
  const nC0 = d0.shape[1]

  const ones = Matrix.empty([nC2, 1], Int32Array)
  ones.data.fill(1)

  // Compute boundary 1-cell (oriented)
  //   c1B = (1,..,1) d1^T
  const c1B = Matrix.empty([nC1, 1], Int32Array)
  d1.matmulT(c1B, ones)

  // |d0|
  const _d0 = d0.clone()
  _d0.data.fill(1)

  // |c1B|
  const _c1B = c1B.clone().abs()

  // Compute boundary 0-cell (not oriented)
  //   c0B = |c1B| |d0|^T
  const c0B = Matrix.empty([nC0, 1], Int32Array)
  _d0.matmulT(c0B, _c1B)

  return { c1B, c0B }
}

const computeBoundaryLoop = (root, c0B, c1B, c1xc0) => {
  // assert root in c0B
  if (c0B.data[root] === 0) {
    throw new Error('[computeBoundaryLoop]')
  }

  const nC0 = c0B.data.length
  const nC1 = c1B.data.length
  const nC1B = c1B.data.filter(v => v !== 0).length

  // Make c0xc0 adjacency matrix with oriented boundary edge as data (as encoding is "sign * (id + 1)")
  // Actually `data` is not necessarily for `computeSpanningTreeV3` to work,
  // but probably it is useful/natural if `loop` already combines edge data.
  let c0xc0 = MatrixCOO.empty([nC0, nC0], 2 * nC1B, Int32Array)
  for (let i = 0; i < nC1; i++) {
    if (c1B.data[i] === 0) { continue }
    const vs = c1xc0.row(i)
    c0xc0.set(vs[0], vs[1], i + 1)
    c0xc0.set(vs[1], vs[0], -(i + 1))
  }
  c0xc0 = MatrixCSR.fromCOO(c0xc0)

  // `computeSpanningTreeV3` returns MatrixCOO with DFS topological order of vertices, which should be naturally loop.
  // TODO: currently it allocates MatrixCOO with nnz = nC0. maybe should support nnz as optional argument?
  const loop = computeSpanningTreeV3(root, c0xc0)
  return loop
}

const toSelectorMatrix = (bools) => {
  const nS = bools.length
  const nT = bools.filter(v => v !== 0).length // treat as true if not zero
  const S = MatrixCSR.empty([nT, nS], nT)
  S.indptr.set(_.range(nT + 1))
  S.data.fill(1)
  let k = 0
  for (let i = 0; i < nS; i++) {
    if (bools[i] === 0) { continue }
    S.indices[k++] = i
  }
  return S
}

// Typical example for Laplace equation with Dirichlet boundary condition
class HarmonicParametrizationSolver {
  compute (verts, c2xc0, iteration = 1024, residue = 1e-2) {
    const nC0 = verts.shape[0]

    // 1. laplacian
    let L = computeLaplacianV2(verts, c2xc0)
    L = MatrixCSR.fromCOO(L)
    L.sumDuplicates()

    // 2. boundary
    const { c1xc0, d1 } = computeD1(c2xc0, nC0, /* checkTwoManiforld */ true)
    const { d0 } = computeD0(c1xc0, nC0)
    const { c0B, c1B } = computeBoundaryC2(d0, d1)
    const nC0B = c0B.data.filter(v => v !== 0).length
    const nC0I = nC0 - nC0B
    if (nC0B === 0) {
      throw new Error('[HarmonicParametrizationSolver] boundary vertex not found')
    }

    // 3. interior selector matrix
    const Si = toSelectorMatrix(c0B.clone().negate().data)

    // 4. laplacian restricted on interior
    const SiT = Si.transpose()
    const Si_L = Si.matmulCsr(L)
    const Si_L_SiT = Si_L.matmulCsr(SiT) // negative definite if there's really boundary vertex
    const neg_Si_L_SiT = Si_L_SiT.clone().muleqs(-1) // positive definite

    // 5. boundary loop
    const root = c0B.data.findIndex(v => v !== 0)
    const loop = computeBoundaryLoop(root, c0B, c1B, c1xc0) // MatrixCOO
    let orient
    {
      // currently computeBoundaryLoop is not smart enough,
      // so here is quick way to find orientation of loop
      const { sign, abs } = Math
      const d1T = d1.transpose()
      const e = abs(loop.data[0]) - 1 // our encoding (note that this "sign" is NOT 1-cell orientation wrt. 2-cell boundary)
      orient = sign(d1T.row(e).data[0])
    }

    // 6. map boundary loop to 2d loop (i.e. boundary condition for Laplace equation)
    //   (here, just map curve which only respects |\del_t \gamma|)
    const u = Matrix.empty([nC0, 1]) // directly fill boundary value to solution vector
    const v = Matrix.empty([nC0, 1])
    {
      const { cos, sin, PI } = Math
      const { sub, length } = glm.vec3

      // Compute edge lengths
      const lengths = new Float32Array(loop.nnz)
      let total = 0
      let p = verts.row(root)
      for (let i = 0; i < loop.nnz; i++) { // Traverse loop as MatrixCOO
        const q = verts.row(loop.col[i])
        const l = length(sub(q, p))
        lengths[i] = l
        total += l
        p = q
      }
      total += length(sub(verts.row(root), p))

      // Scale and map to unit circle
      let t = 0
      u.data[root] = cos(t)
      v.data[root] = sin(t)
      for (let i = 0; i < loop.nnz; i++) {
        t += orient * 2 * PI * lengths[i] / total
        u.data[loop.col[i]] = cos(t)
        v.data[loop.col[i]] = sin(t)
      }
    }

    // 7. solve laplace equation
    //  0 = (L u)|_interior
    //    = Si . L . (Si^T ui + Sb^T ub)
    //    = (Si . L . Si^T) ui + (Si . L . Sb^T) ub
    //  <=>
    //  - (Si . L . Si^T) ui = (Si . L . Sb^T) ub
    const stats = {}
    {
      const ui = Matrix.empty([nC0I, 1])
      const rhs = Matrix.emptyLike(ui)
      Si_L.matmul(rhs, u) // we've filled boundary value "SbT . ub" directly in "u"

      // [conjugateGradient]
      stats.u = neg_Si_L_SiT.conjugateGradient(ui, rhs, iteration, residue)

      // [gaussSeidel] TODO: for gaussSeidel, we can run iteration for u and v at the same time.
      // neg_Si_L_SiT.gaussSeidel(ui, rhs, 800)

      // u = Si^T ui + Sb^T ub
      const SiT_ui = Matrix.emptyLike(u)
      SiT.matmul(SiT_ui, ui)
      u.addeq(SiT_ui)
    }
    {
      const vi = Matrix.empty([nC0I, 1])
      const rhs = Matrix.emptyLike(vi)
      Si_L.matmul(rhs, v)

      // [conjugateGradient]
      stats.v = neg_Si_L_SiT.conjugateGradient(vi, rhs, iteration, residue)

      // [gaussSeidel]
      // neg_Si_L_SiT.gaussSeidel(vi, rhs, 800)

      const SiT_vi = Matrix.emptyLike(v)
      SiT.matmul(SiT_vi, vi)
      v.addeq(SiT_vi)
    }

    return { u, v, stats }
  }
}

const c3xc0Toc0xc3 = (c3xc0, nC0) => {
  // Represent c3xc0 as MatrixCSR
  const nC3 = c3xc0.shape[0]
  const tmp = MatrixCSR.empty([nC3, nC0], 4 * nC3, Uint8Array) // 0/1 entry
  tmp.indptr = _.range(nC3 + 1).map(i => 4 * i)
  tmp.indices = c3xc0.data
  tmp.data.fill(1)

  // Take transpose which represents c0xc3 (we don't have "uniform" row structure any more)
  const c0xc3 = tmp.transpose()
  return c0xc3
}

const computeFrameSelectorC3 = (c3xc0, nC0) => {
  const nC3 = c3xc0.shape[0]
  const a = MatrixCSR.empty([3 * nC3, nC0], 2 * 3 * nC3)

  // indptr: 2 entry for each row
  a.indptr.set(_.range(a.shape[0] + 1).map(i => 2 * i))

  // indices, data
  for (let i = 0; i < nC3; i++) {
    const vs = c3xc0.row(i)
    const v0 = vs[0]
    for (let j = 0; j < 3; j++) {
      const vj = vs[j + 1]
      // Make sure indices are already sorted
      const swap = v0 > vj
      a.indices[2 * (3 * i + j) + 0] = swap ? vj : v0
      a.indices[2 * (3 * i + j) + 1] = swap ? v0 : vj
      a.data[2 * (3 * i + j) + 0] = swap ? 1 : -1
      a.data[2 * (3 * i + j) + 1] = swap ? -1 : 1
    }
  }

  return a
}

// TODO: should it be possible to compute during `computeD1`?
const computeC2xc1 = (c2xc0, c1xc0, d1) => {
  const { min, max } = Math
  const nC2 = c2xc0.shape[0]
  const c2xc1 = Matrix.empty([nC2, 3], Uint32Array)
  for (let i = 0; i < nC2; i++) {
    const vs = c2xc0.row(i)
    const es = d1.indices.slice(d1.indptr[i], d1.indptr[i] + 3)
    const e0 = es.find(e => c1xc0.get(e, 0) === min(vs[0], vs[1]) && c1xc0.get(e, 1) === max(vs[0], vs[1]))
    const e1 = es.find(e => c1xc0.get(e, 0) === min(vs[1], vs[2]) && c1xc0.get(e, 1) === max(vs[1], vs[2]))
    const e2 = es.find(e => c1xc0.get(e, 0) === min(vs[2], vs[0]) && c1xc0.get(e, 1) === max(vs[2], vs[0]))
    c2xc1.row(i).set([e0, e1, e2])
  }
  return c2xc1
}

const computeVertexNormals = (verts, c2xc0) => {
  const nC0 = verts.shape[0]
  const nC2 = c2xc0.shape[0]
  const faceNormals = computeFaceNormals(verts, c2xc0)
  const vertNormals = Matrix.empty([nC0, 3])
  const counts = new Uint32Array(nC0)

  const { addeq, diveqs, normalizeeq } = glm.vec3

  // Accumulate face normals
  for (let i = 0; i < nC2; i++) {
    const n = faceNormals.row(i)
    const vs = c2xc0.row(i)
    addeq(vertNormals.row(vs[0]), n)
    addeq(vertNormals.row(vs[1]), n)
    addeq(vertNormals.row(vs[2]), n)
    counts[vs[0]]++
    counts[vs[1]]++
    counts[vs[2]]++
  }

  // Average them and normalize
  for (let i = 0; i < nC0; i++) {
    normalizeeq(diveqs(vertNormals.row(i), counts[i]))
  }

  return vertNormals
}

//
// Each triangle prism is subdivided to 13 tetrahedra by
//
//      2
//     8 7
//    0 6 1
//
//       5
//   11 12 10
//    3  9  4
//
//  where
//   - [0, 1, 2] is the original triangle
//   - [3, 4, 5] is the extruded triangle
//
const extrudeTrianglesToTetrahedra = (verts, c2xc0, depth) => {
  const nC0 = verts.shape[0]
  const nC2 = c2xc0.shape[0]

  const { c1xc0, d1 } = computeD1(c2xc0, nC0, /* checkTwoManiforld */ true)
  const nC1 = c1xc0.shape[0]
  const c2xc1 = computeC2xc1(c2xc0, c1xc0, d1)

  const new_nC0 = 2 * nC0 + 2 * nC1 + nC2
  const new_nC3 = 13 * nC2
  const new_verts = Matrix.empty([new_nC0, 3])
  const new_c3xc0 = Matrix.empty([new_nC3, 4], Uint32Array)

  // Offset of new vertices (3..12)
  const offset0 = nC0 // 3, 4, 5
  const offset1 = 2 * nC0 // 6, 7, 8
  const offset2 = 2 * nC0 + nC1 // 9, 10, 11
  const offset3 = 2 * nC0 + 2 * nC1 // 12

  // c3xc0 (topology)
  for (let i = 0; i < nC2; i++) {
    const vs = c2xc0.row(i)
    const es = c2xc1.row(i)
    const v0 = vs[0]
    const v1 = vs[1]
    const v2 = vs[2]
    const v3 = vs[0] + offset0
    const v4 = vs[1] + offset0
    const v5 = vs[2] + offset0
    const v6 = es[0] + offset1
    const v7 = es[1] + offset1
    const v8 = es[2] + offset1
    const v9 = es[0] + offset2
    const v10 = es[1] + offset2
    const v11 = es[2] + offset2
    const v12 = i + offset3
    new_c3xc0.row(13 * i + 0).set([v0, v3, v8, v6])
    new_c3xc0.row(13 * i + 1).set([v12, v3, v6, v8])
    new_c3xc0.row(13 * i + 2).set([v1, v4, v6, v7])
    new_c3xc0.row(13 * i + 3).set([v12, v4, v7, v6])
    new_c3xc0.row(13 * i + 4).set([v2, v5, v7, v8])
    new_c3xc0.row(13 * i + 5).set([v12, v5, v8, v7])
    new_c3xc0.row(13 * i + 6).set([v12, v9, v6, v3])
    new_c3xc0.row(13 * i + 7).set([v12, v9, v4, v6])
    new_c3xc0.row(13 * i + 8).set([v12, v10, v7, v4])
    new_c3xc0.row(13 * i + 9).set([v12, v10, v5, v7])
    new_c3xc0.row(13 * i + 10).set([v12, v11, v8, v5])
    new_c3xc0.row(13 * i + 11).set([v12, v11, v3, v8])
    new_c3xc0.row(13 * i + 12).set([v12, v6, v7, v8])
  }

  // new_verts (positions)
  const { add, sub, muls, divs } = glm.vec3
  const vertNormals = computeVertexNormals(verts, c2xc0)

  for (let i = 0; i < nC0; i++) {
    const p = verts.row(i)
    const n = vertNormals.row(i)
    new_verts.row(i).set(p)
    new_verts.row(i + offset0).set(sub(p, muls(n, depth))) // extrude inward
  }

  for (let i = 0; i < nC1; i++) {
    const vs = c1xc0.row(i)
    const p0 = new_verts.row(vs[0])
    const p1 = new_verts.row(vs[1])
    const p2 = new_verts.row(vs[0] + offset0)
    const p3 = new_verts.row(vs[1] + offset0)
    new_verts.row(i + offset1).set(divs(add(p0, p1), 2))
    new_verts.row(i + offset2).set(divs(add(p2, p3), 2))
  }

  for (let i = 0; i < nC2; i++) {
    const vs = c2xc0.row(i)
    const p0 = new_verts.row(vs[0] + offset0)
    const p1 = new_verts.row(vs[1] + offset0)
    const p2 = new_verts.row(vs[2] + offset0)
    new_verts.row(i + offset3).set(divs(add(add(p0, p1), p2), 3))
  }

  return [new_verts, new_c3xc0]
}

export {
  computeTopology, computeMore, computeLaplacian, computeMeanCurvature,
  computeSpanningTree, computeSpanningTreeV2, computeTreeCotree,
  solvePoisson, solveGaussSeidel,
  matmul, transposeVerts, computeMeanCurvatureV2,
  computeLaplacianV2, computeMoreV2, computeTopologyV2, computeHodge1,
  computeF2f, computeSpanningTreeV3, computeFaceNormals, computeFaceCentroids,
  VectorFieldSolver,
  computeD2, computeD1, computeD0, computeBoundary, c3xc0Toc0xc3,
  computeBoundaryC3, computeBoundaryC2, computeBoundaryLoop,
  HarmonicParametrizationSolver, toSelectorMatrix,
  computeFrameSelectorC3,
  extrudeTrianglesToTetrahedra, computeC2xc1
}
