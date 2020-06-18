/* eslint camelcase: 0 */

import _ from '../../web_modules/lodash.js'
import * as glm from './glm.js'
import { Matrix, MatrixCOO, MatrixCSR } from './array.js'

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

          if (dup === 0) {
            foundBoundary = true
            boundaryEdge[ePrev] = true
            numBoundaryEdgesPerFace[fPrev]++
          }
          dup = 0
        } else {
          dup++
          if (dup > 2) {
            throw new Error('[computeTopologyV3] More than 2 faces share single edge')
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

export {
  computeTopology, computeMore, computeLaplacian, computeMeanCurvature,
  computeSpanningTree, computeSpanningTreeV2, computeTreeCotree,
  solvePoisson, solveGaussSeidel,
  matmul, transposeVerts, computeMeanCurvatureV2,
  computeLaplacianV2, computeMoreV2, computeTopologyV2, computeHodge1,
  computeF2f, computeSpanningTreeV3, computeFaceNormals
}
