/* global performance */

//
// Miscellaneous but (hopefully) without external dependencies
//
import _ from '../../web_modules/lodash.js'
import * as glm from './glm.js'
import { Matrix } from './array.js'
import { hash11 } from './hash.js'

// Scale a set of positions to [-1, 1]^3
const normalizePositions = (verts) => {
  const { add, sub, mul, divs, min, max } = glm.vec3
  const center = divs(verts.reduce(add), verts.length)
  const bboxMin = verts.reduce(min)
  const bboxMax = verts.reduce(max)
  const size = Math.max(...sub(bboxMax, bboxMin))
  const result = verts.map(v => mul(2 / size, sub(v, center)))
  return result
}

// verts: float[nV, 3]
const normalizePositionsV2 = (verts) => {
  const { addeq, subeq, muleqs, diveqs, mineq, maxeq, clone } = glm.vec3

  const center = [0, 0, 0]
  const bboxMin = clone(verts.row(0))
  const bboxMax = clone(verts.row(0))
  for (let i = 0; i < verts.shape[0]; i++) {
    addeq(center, verts.row(i))
    mineq(bboxMin, verts.row(i))
    maxeq(bboxMax, verts.row(i))
  }
  diveqs(center, verts.shape[0])

  const size = Math.max(...subeq(bboxMax, bboxMin))
  for (let i = 0; i < verts.shape[0]; i++) {
    muleqs(subeq(verts.row(i), center), 2 / size)
  }
}

// Convienient for quick visualization of signed value
// (piecewise linear with knot at value = 0)
const getSignedColor = (value, color0, colorP, colorN) => {
  return value > 0
    ? glm.vec3.mix(color0, colorP, value)
    : glm.vec3.mix(color0, colorN, -value)
}

const cumsum = (a) => {
  const b = new Array(a.length + 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    b[i + 1] = b[i] + a[i]
  }
  return b
}

const makeTriangle = (n = 1, p0 = [0, 0, 0], p1 = [1, 0, 0], p2 = [0.5, 0.5 * Math.sqrt(3), 0]) => {
  const { add, sub, muls } = glm.vec3
  const u1 = sub(p1, p0)
  const u2 = sub(p2, p0)

  const nV = (n + 2) * (n + 1) / 2
  const nF = n * n
  const verts = Matrix.empty([nV, 3])
  const f2v = Matrix.empty([nF, 3], Uint32Array)

  let k = 0 // track vertex index
  let l = 0 // track face index
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n - j; i++) {
      // (i, j+1) --- (i+1, j+1)       c --- d
      //     |     \     |             |  \  |
      // (i,   j) --- (i+1, j)         a --- b
      const a = k++
      const b = a + 1
      const c = a + n + 1 - j
      const d = c + 1

      // Create vertex at (i, j)
      verts.row(a).set(
        add(p0, add(muls(u1, i / n), muls(u2, j / n))))

      // Create two face
      f2v.row(l++).set([a, b, c])
      if (i < n - j - 1) {
        f2v.row(l++).set([d, c, b])
      }
    }

    // Create vertex at (n - j, j)
    verts.row(k++).set(
      add(p0, add(muls(u1, (n - j) / n), muls(u2, j / n))))
  }

  // Create vertex at (0, n)
  verts.row(k++).set(p2)

  return { verts, f2v }
}

// TODO: use or implement similar to https://github.com/visionmedia/debug
const measure = (label, func) => {
  const t0 = performance.now()
  const result = func()
  const t1 = performance.now()
  console.log(`[measure:${label}] ${(t1 - t0).toPrecision(5)} msec`)
  return result
}

// Quick way to assert with expression as message
const assertf = (f) => {
  if (!f()) { throw new Error(f.toString().slice(6)) }
}

// Inlined insertion sort of three elements
const sort3 = (i, j, k) => {
  // [i, (j), k]
  if (j < i) {
    // [j, i, (k)]
    if (k < i) {
      // [j, (k), i]
      if (k < j) {
        return [k, j, i]
      }
      return [j, k, i]
    }
    return [j, i, k]
  }

  // [i, j, (k)]
  if (k < j) {
    // [i, (k), j]
    if (k < i) {
      return [k, i, j]
    }
    return [i, k, j]
  }
  return [i, j, k]
}

// Variant of `sort3` where it returns four elements with last entry indicetes parity
const sortParity3 = (i, j, k) => {
  // [i, (j), k]
  if (j < i) {
    // [j, i, (k)]
    if (k < i) {
      // [j, (k), i]
      if (k < j) {
        return [k, j, i, -1]
      }
      return [j, k, i, 1]
    }
    return [j, i, k, -1]
  }

  // [i, j, (k)]
  if (k < j) {
    // [i, (k), j]
    if (k < i) {
      return [k, i, j, 1]
    }
    return [i, k, j, -1]
  }
  return [i, j, k, 1]
}

// I thought inplace version might be faster but it seems not (cf. misc2.bench.js)
const _sortParity3 = (ijk) => {
  const i = ijk[0]
  const j = ijk[1]
  const k = ijk[2]

  // [i, (j), k]
  if (j < i) {
    // [j, i, (k)]
    if (k < i) {
      // [j, (k), i]
      if (k < j) {
        ijk[0] = k
        ijk[1] = j
        ijk[2] = i
        return false
      }
      ijk[0] = j
      ijk[1] = k
      ijk[2] = i
      return true
    }
    ijk[0] = j
    ijk[1] = i
    ijk[2] = k
    return false
  }

  // [i, j, (k)]
  if (k < j) {
    // [i, (k), j]
    if (k < i) {
      ijk[0] = k
      ijk[1] = i
      ijk[2] = j
      return true
    }
    ijk[0] = i
    ijk[1] = k
    ijk[2] = j
    return false
  }
  ijk[0] = i
  ijk[1] = j
  ijk[2] = k
  return true
}

// Conversion routine from previously often used geometry format of mine
const toMatrices = (position, index) => {
  const nV = position.length
  const nF = index.length
  const verts = Matrix.empty([nV, 3])
  const f2v = Matrix.empty([nF, 3], Uint32Array)
  verts.data.set(position.flat())
  f2v.data.set(index.flat())
  return { verts, f2v }
}

// TODO: Sadly this is copy-paste from misc.js to use this in physics.bench.js and avoid AFRAME dependency
const makePlane = (segmentsX = 1, segmentsY = 1, periodicX = false, periodicY = false, triangle = true, uniformTriangulation = true) => {
  const n = segmentsX
  const m = segmentsY

  // verts
  const xx = _.range(n + 1).map(i => i / n)
  const yy = _.range(n + 1).map(i => i / m)
  if (periodicX) { xx.pop() }
  if (periodicY) { yy.pop() }
  const position = yy.map(y => xx.map(x => [x, y, 0])).flat()

  // f2v
  const index = []
  const nn = periodicX ? n : n + 1
  const mm = periodicY ? m : m + 1
  for (const x of _.range(n)) {
    for (const y of _.range(m)) {
      const quad = [
        nn * ((y + 0) % mm) + ((x + 0) % nn),
        nn * ((y + 0) % mm) + ((x + 1) % nn),
        nn * ((y + 1) % mm) + ((x + 1) % nn),
        nn * ((y + 1) % mm) + ((x + 0) % nn)
      ]
      if (!triangle) {
        index.push(quad)
        continue
      }
      const [a, b, c, d] = quad
      if (uniformTriangulation) {
        index.push([a, b, c], [a, c, d])
        continue
      }
      const cointoss = hash11(x * 123 + (y * 235) << 8) >= 0.5
      const faces = cointoss ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]
      index.push(...faces)
    }
  }

  return { position, index }
}

const tetrahedralizeBox6 = (a0, a1, a2, a3, a4, a5, a6, a7) => {
  // Tetrahedralize box by 6 permutations of x < y < z
  //    6 -- 7
  //   /|  / |
  // 4 -- 5  |
  // |  | |  |
  // |  2 |- 3
  // | /  |/
  // 0 -- 1
  return [
    // Enumerate permutation group S3
    a0, a1, a3, a7, // z < y < x (1)
    a0, a4, a5, a7, // y < x < z (2) (rotate (1))
    a0, a2, a6, a7, // x < z < y (3) (rotate (2))
    a0, a3, a2, a7, // z < x < y (4) (flip x and y of (1))
    a0, a5, a1, a7, // z < x < y (5) (rotate (4))
    a0, a6, a4, a7 // z < x < y (6) (rotate (5))
  ]
}

const tetrahedralizeBox5 = (a0, a1, a2, a3, a4, a5, a6, a7) => {
  // Tetrahedralize box by one regular tetrahedron and four left-overs
  return [
    a4, a1, a2, a7, // regular
    a0, a1, a2, a4,
    a3, a1, a7, a2,
    a5, a1, a4, a7,
    a6, a2, a7, a4
  ]
}

const roll = (a, shift) => {
  shift = ((shift % a.length) + a.length) % a.length
  const i = a.length - shift
  const b = [].concat(a.slice(i), a.slice(0, i))
  return b
}

const makeTetrahedralizedCube = (n = 1) => {
  const nC0 = (n + 1) ** 3
  const nC3 = 6 * (n ** 3)

  const verts = Matrix.empty([nC0, 3])
  const c3xc0 = Matrix.empty([nC3, 4], Uint32Array)

  // verts
  for (let k = 0; k <= n; k++) {
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const p = (n + 1) * (n + 1) * k + (n + 1) * j + i
        verts.row(p).set([i / n, j / n, k / n])
      }
    }
  }

  // c3xc0
  let q = 0
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a0 = (n + 1) * (n + 1) * k + (n + 1) * j + i
        const a1 = a0 + 1
        const a2 = a0 + (n + 1)
        const a3 = a2 + 1
        const a4 = a0 + (n + 1) * (n + 1)
        const a5 = a4 + 1
        const a6 = a4 + (n + 1)
        const a7 = a6 + 1
        const tetrahedra = tetrahedralizeBox6(a0, a1, a2, a3, a4, a5, a6, a7)
        const offset = c3xc0.index(6 * (q++), 0)
        c3xc0.data.set(tetrahedra, offset)
      }
    }
  }

  return { verts, c3xc0 }
}

const makeTetrahedralizedCubeSymmetric = (m = 1) => {
  const n = 2 * m
  const nC0 = (n + 1) ** 3
  const nC3 = 5 * (n ** 3)

  const verts = Matrix.empty([nC0, 3])
  const c3xc0 = Matrix.empty([nC3, 4], Uint32Array)

  // verts
  for (let k = 0; k <= n; k++) {
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const p = (n + 1) * (n + 1) * k + (n + 1) * j + i
        verts.row(p).set([i / n, j / n, k / n])
      }
    }
  }

  // c3xc0
  let q = 0
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let a0 = (n + 1) * (n + 1) * k + (n + 1) * j + i
        let a1 = a0 + 1
        let a2 = a0 + (n + 1)
        let a3 = a2 + 1
        let a4 = a0 + (n + 1) * (n + 1)
        let a5 = a4 + 1
        let a6 = a4 + (n + 1)
        let a7 = a6 + 1
        if ((i + j + k) % 2 === 0) {
          [a0, a1, a3, a2] = roll([a0, a1, a3, a2], 1);
          [a4, a5, a7, a6] = roll([a4, a5, a7, a6], 1)
        }
        const tetrahedra = tetrahedralizeBox5(a0, a1, a2, a3, a4, a5, a6, a7)
        const offset = c3xc0.index(5 * (q++), 0)
        c3xc0.data.set(tetrahedra, offset)
      }
    }
  }

  return { verts, c3xc0 }
}

export {
  normalizePositions, normalizePositionsV2,
  getSignedColor, cumsum, makeTriangle,
  measure, assertf, sort3, sortParity3, _sortParity3,
  makePlane, toMatrices,
  makeTetrahedralizedCube, makeTetrahedralizedCubeSymmetric,
  roll
}
