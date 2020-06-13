/* eslint camelcase: 0 */

// Minimal lodash
const _ = {
  range: (n) => {
    const result = []
    for (let i = 0; i < n; i++) {
      result.push(i)
    }
    return result
  },

  zip: (a, b) => {
    return _.range(a.length).map(i => [a[i], b[i]])
  },

  sum: (a) => {
    return a.reduce((e1, e2) => e1 + e2)
  }
}

const flatten = (...args) => {
  return args.map(a => a[Symbol.iterator] ? [...a] : [a]).flat()
}

const isScalar = (a) => {
  return typeof a === 'number'
}

const vec2 = (...args) => {
  if (args.length === 1) {
    if (isScalar(args[0])) {
      return vec2(args[0], args[0])
    }
  }
  return flatten(args).slice(0, 2)
}

const vec3 = (...args) => {
  if (args.length === 1) {
    if (isScalar(args[0])) {
      return vec3(args[0], args[0], args[0])
    }
  }
  return flatten(args).slice(0, 3)
}

const vec4 = (...args) => {
  if (args.length === 1) {
    if (isScalar(args[0])) {
      return vec3(args[0], args[0], args[0], args[0])
    }
  }
  return flatten(args).slice(0, 4)
}

// const mat2 = (...args) => {
// }

// const mat3 = (...args) => {
// }

// const mat4 = (...args) => {
// }

const broadcast = (a, b) => {
  if (!a.length && !b.length) {
    throw new Error('broadcast')
  }
  const l = Math.max(a.length || 1, b.length || 1)
  if (!a.length) {
    a = new Array(l).fill(a)
  }
  if (!b.length) {
    b = new Array(l).fill(b)
  }
  return _.zip(a, b)
}

const add = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => aa + bb)
}

const sub = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => aa - bb)
}

const mul = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => aa * bb)
}

const div = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => aa / bb)
}

// TODO:
// implement adds, addeq, addeqs
// add(a, b) => addeq(clone(a), b)
// adds(a, b) => addeqs(clone(a), b)

const subeq = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    a[i] = a[i] - b[i]
  }
  return a
}

const subeqs = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    a[i] = a[i] - b
  }
  return a
}

const min = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => Math.min(aa, bb))
}

const max = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => Math.max(aa, bb))
}

const Math_mix = (a, b, t) => {
  return a + t * (b - a)
}

const mix = (a, b, t) => {
  return broadcast(a, b).map(([aa, bb]) => Math_mix(aa, bb, t))
}

const dot = (a, b) => {
  let x = 0
  for (let i = 0; i < a.length; i++) {
    x += a[i] * b[i]
  }
  return x
}

const cross = (a, b) => {
  // [ Slower variant ]
  // const [a0, a1, a2] = a
  // const [b0, b1, b2] = b
  // return [
  //   a1 * b2 - a2 * b1,
  //   a2 * b0 - a0 * b2,
  //   a0 * b1 - a1 * b0
  // ]
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

const dot2 = (a) => {
  return dot(a, a)
}

const pow2 = (a) => {
  if (isScalar(a)) { return a * a }
  return mul(a, a)
}

const length = (a) => {
  return Math.sqrt(dot2(a))
}

const normalize = (a) => {
  return div(a, length(a))
}

// [ Slower variant ]
// const clone = Array.from
// const clone = (a) => [...a]
// const clone = a => a.map(v => v)
const clone = (a) => {
  const b = new Array(a.length)
  for (let i = 0; i < a.length; i++) {
    b[i] = a[i]
  }
  return b
}

// Specialized variant (for now, the ones used in `computeLaplacianV2`)
// TOOD: auto generate via eval
const v3 = {
  subeq: (a, b) => {
    a[0] -= b[0]
    a[1] -= b[1]
    a[2] -= b[2]
    return a;
  },

  dot: (a, b) => {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  },

  length: (a) => {
    return Math.sqrt(v3.dot(a, a))
  },

  clone: (a) => {
    return [a[0], a[1], a[2]]
  },
}

export {
  vec2, vec3, vec4, /* mat2, mat3, mat4, */
  add, sub, mul, div, /* mmul */
  dot, cross, length, normalize, min, max, mix,
  /* inverse, transpose, */
  pow2, dot2, /* diag, outer, outer2, */
  clone,
  subeq,
  v3,
}
