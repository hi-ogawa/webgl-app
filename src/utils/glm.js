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

const min = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => Math.min(aa, bb))
}

const max = (a, b) => {
  return broadcast(a, b).map(([aa, bb]) => Math.max(aa, bb))
}

const dot = (a, b) => {
  return _.sum(mul(a, b))
}

const cross = (a, b) => {
  const [a0, a1, a2] = a
  const [b0, b1, b2] = b
  return [
    a1 * b2 - a2 * b1,
    a2 * b0 - a0 * b2,
    a0 * b1 - a1 * b0
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

export {
  vec2, vec3, vec4, /* mat2, mat3, mat4, */
  add, sub, mul, div, /* mmul */
  dot, cross, length, normalize, min, max,
  /* inverse, transpose, */
  pow2, dot2 /* diag, outer, outer2, */
}
