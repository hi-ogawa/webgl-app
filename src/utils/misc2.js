//
// Miscellaneous but (hopefully) without external dependencies
//
import * as glm from './glm.js'

// Scale to [-1, 1]^3
const normalizePositions = (verts) => {
  const { sub, mul, div, min, max } = glm
  const bboxMin = verts.reduce(min)
  const bboxMax = verts.reduce(max)
  const bboxSize = sub(bboxMax, bboxMin)
  const result = verts.map(v =>
    sub(mul(2, div(sub(v, bboxMin), bboxSize)), 1))
  return result
}

export {
  normalizePositions
}
