//
// Miscellaneous but (hopefully) without external dependencies
//
import * as glm from './glm.js'

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

export {
  normalizePositions, normalizePositionsV2,
  getSignedColor, cumsum
}
