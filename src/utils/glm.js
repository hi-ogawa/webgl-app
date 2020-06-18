/* eslint camelcase: 0, no-eval: 0 */

const _ = {
  range: (n) => {
    const result = []
    for (let i = 0; i < n; i++) {
      result.push(i)
    }
    return result
  }
}

// Generate binary operators
const generateOperators = (name, op, n) => {
  // e.g. add
  const code = `(a, b) => {
    const c = new Array(3)
    ${
      _.range(n).map(i =>
        `c[${i}] = ${op(`a[${i}]`, `b[${i}]`)}`
      ).join('\n')
    }
    return c
  }`

  // e.g. adds
  const code_s = `(a, b) => {
    const c = new Array(3)
    ${
      _.range(n).map(i =>
        `c[${i}] = ${op(`a[${i}]`, 'b')}`
      ).join('\n')
    }
    return c
  }`

  // e.g. addeq
  const code_eq = `(a, b) => {
    ${
      _.range(n).map(i =>
        `a[${i}] = ${op(`a[${i}]`, `b[${i}]`)}`
      ).join('\n')
    }
    return a
  }`

  // e.g. addeqs
  const code_eqs = `(a, b) => {
    ${
      _.range(n).map(i =>
        `a[${i}] = ${op(`a[${i}]`, 'b')}`
      ).join('\n')
    }
    return a
  }`

  return {
    [`${name}`]: eval(code),
    [`${name}s`]: eval(code_s),
    [`${name}eq`]: eval(code_eq),
    [`${name}eqs`]: eval(code_eqs)
  }
}

// TODO: Check if Float32Array is faster (probably so)
const vec3 = {
  vec3: (x, y, z) => {
    const a = new Float32Array(3)
    a[0] = x
    a[1] = y
    a[2] = z
    return a
  },

  ...generateOperators('add', (lhs, rhs) => `${lhs} + ${rhs}`, 3),
  ...generateOperators('sub', (lhs, rhs) => `${lhs} - ${rhs}`, 3),
  ...generateOperators('mul', (lhs, rhs) => `${lhs} * ${rhs}`, 3),
  ...generateOperators('div', (lhs, rhs) => `${lhs} / ${rhs}`, 3),
  ...generateOperators('max', (lhs, rhs) => `Math.max(${lhs}, ${rhs})`, 3),
  ...generateOperators('min', (lhs, rhs) => `Math.min(${lhs}, ${rhs})`, 3),

  mix: (a, b, t) => {
    return [
      a[0] + t * (b[0] - a[0]),
      a[1] + t * (b[1] - a[1]),
      a[2] + t * (b[2] - a[2])
    ]
  },

  crosseq: (a, b) => {
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    const b0 = b[0]
    const b1 = b[1]
    const b2 = b[2]
    a[0] = a1 * b2 - a2 * b1
    a[1] = a2 * b0 - a0 * b2
    a[2] = a0 * b1 - a1 * b0
    return a
  },

  cross: (a, b) => {
    // Much slower
    // return new Float32Array([
    //   a[1] * b[2] - a[2] * b[1],
    //   a[2] * b[0] - a[0] * b[2],
    //   a[0] * b[1] - a[1] * b[0]
    // ])
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ]
  },

  dot: (a, b) => {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  },

  dot2: (a) => {
    return vec3.dot(a, a)
  },

  // TODO: This helps since somehow it happens that "length(normalizeeq(v)) > 1"
  dotClamp: (a, b) => {
    return Math.max(-1, Math.min(1, vec3.dot(a, b)))
  },

  length: (a) => {
    return Math.sqrt(vec3.dot2(a))
  },

  normalize: (a) => {
    return vec3.divs(a, vec3.length(a))
  },

  normalizeeq: (a) => {
    return vec3.diveqs(a, vec3.length(a))
  },

  clone: (a) => {
    return [a[0], a[1], a[2]]
  },

  copy: (a, b) => {
    a[0] = b[0]
    a[1] = b[1]
    a[2] = b[2]
    return a
  },

  assign: (a, b) => {
    a[0] = b[0]
    a[1] = b[1]
    a[2] = b[2]
    return a
  },

  matmuleq: (m, a) => {
    const m00 = m[0]
    const m10 = m[1]
    const m20 = m[2]
    const m01 = m[3]
    const m11 = m[4]
    const m21 = m[5]
    const m02 = m[6]
    const m12 = m[7]
    const m22 = m[8]
    const a0 = a[0]
    const a1 = a[1]
    const a2 = a[2]
    a[0] = m00 * a0 + m01 * a1 + m02 * a2
    a[1] = m10 * a0 + m11 * a1 + m12 * a2
    a[2] = m20 * a0 + m21 * a1 + m22 * a2
    return a
  },

  matmul: (m, a) => {
    return vec3.matmuleq(m, vec3.clone(a))
  }
}

const mat3 = {
  ...generateOperators('add', (lhs, rhs) => `${lhs} + ${rhs}`, 9),
  ...generateOperators('sub', (lhs, rhs) => `${lhs} - ${rhs}`, 9),
  ...generateOperators('mul', (lhs, rhs) => `${lhs} * ${rhs}`, 9),
  ...generateOperators('div', (lhs, rhs) => `${lhs} / ${rhs}`, 9),

  axisAngle: (u, t) => {
    const c = Math.cos(0.5 * t)
    const s = Math.sin(0.5 * t)
    const q = [s * u[0], s * u[1], s * u[2], c]
    return quat.toSo3(q)
  },

  outer: (a, b) => {
    return [
      a[0] * b[0], a[1] * b[0], a[2] * b[0],
      a[0] * b[1], a[1] * b[1], a[2] * b[1],
      a[0] * b[2], a[1] * b[2], a[2] * b[2]
    ]
  },

  outer2: (a) => {
    return mat3.outer(a, a)
  },

  cross: (a) => {
    const x = a[0]
    const y = a[1]
    const z = a[2]
    return [
      0, z, -y,
      -z, 0, x,
      y, -x, 0
    ]
  },

  eye: () => {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]
  },

  frameXZ: (x, z) => {
    const y = vec3.cross(z, x)
    return [
      x[0], x[1], x[2],
      y[0], y[1], y[2],
      z[0], z[1], z[2]
    ]
  }
}

// Versers (unit quartenion) utilities
const quat = {
  toSo3: (q) => {
    const v = [q[0], q[1], q[2]]
    const s = q[3]

    const { dot2 } = vec3
    const { addeq, muleqs, outer2, cross, eye } = mat3

    // Cf. https://github.com/hi-ogawa/python-shader-app/blob/2b397649edcb1a4f4faac50129b0a10b99533607/shaders/utils/math_v0.glsl#L132
    // 2 VxV + (s^2 - V.V) I + 2 s C[V]
    const m0 = muleqs(outer2(v), 2)
    const m1 = muleqs(cross(v), 2 * s)
    const m2 = muleqs(eye(), s * s - dot2(v))
    return addeq(m0, addeq(m1, m2))
  }
}

export { vec3, mat3, quat }
