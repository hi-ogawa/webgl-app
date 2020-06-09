//
// Miscellaneous but (hopefully) without external dependencies
//
import * as glm from './glm.js'

// Scale a set of positions to [-1, 1]^3
const normalizePositions = (verts) => {
  const { sub, mul, min, max } = glm
  const center = glm.div(verts.reduce(glm.add), verts.length)
  const bboxMin = verts.reduce(min)
  const bboxMax = verts.reduce(max)
  const size = Math.max(...sub(bboxMax, bboxMin))
  const result = verts.map(v => mul(2 / size, sub(v, center)))
  return result
}

// Convienient for quick visualization of signed value
// (piecewise linear with knot at value = 0)
const getSignedColor = (value, color0, colorP, colorN) => {
  return value > 0
    ? glm.mix(color0, colorP, value)
    : glm.mix(color0, colorN, -value)
}

export {
  normalizePositions, getSignedColor
}
