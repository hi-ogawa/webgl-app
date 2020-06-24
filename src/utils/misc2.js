//
// Miscellaneous but (hopefully) without external dependencies
//
import * as glm from './glm.js'
import { Matrix } from './array.js'

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

const makeTriangle = (n = 1, p0 = [-1, 0, 0], p1 = [1, 0, 0], p2 = [0, Math.sqrt(3), 0]) => {
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

export {
  normalizePositions, normalizePositionsV2,
  getSignedColor, cumsum, makeTriangle
}
