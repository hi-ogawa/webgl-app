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
// TODO: make unary operator
const generateOperators = (name, op, n) => {
  // e.g. add
  const code = `(a, b) => {
    const c = new Array(${n})
    ${
      _.range(n).map(i =>
        `c[${i}] = ${op(`a[${i}]`, `b[${i}]`)}`
      ).join('\n')
    }
    return c
  }`

  // e.g. adds
  const code_s = `(a, b) => {
    const c = new Array(${n})
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

const scalar = {
  mix: (a, b, t) => {
    return a + t * (b - a)
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

  sqrt: (a) => {
    return [Math.sqrt(a[0]), Math.sqrt(a[1]), Math.sqrt(a[2])]
  },

  reciprocal: (a) => {
    return [1 / a[0], 1 / a[1], 1 / a[2]]
  },

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

const vec2 = {
  ...generateOperators('add', (lhs, rhs) => `${lhs} + ${rhs}`, 2),
  ...generateOperators('sub', (lhs, rhs) => `${lhs} - ${rhs}`, 2),
  ...generateOperators('mul', (lhs, rhs) => `${lhs} * ${rhs}`, 2),
  ...generateOperators('div', (lhs, rhs) => `${lhs} / ${rhs}`, 2),
  ...generateOperators('max', (lhs, rhs) => `Math.max(${lhs}, ${rhs})`, 2),
  ...generateOperators('min', (lhs, rhs) => `Math.min(${lhs}, ${rhs})`, 2),

  sqrt: (a) => {
    return [Math.sqrt(a[0]), Math.sqrt(a[1])]
  },

  reciprocal: (a) => {
    return [1 / a[0], 1 / a[1]]
  },

  dot: (a, b) => {
    return a[0] * b[0] + a[1] * b[1]
  },

  dot2: (a) => {
    return vec2.dot(a, a)
  },

  length: (a) => {
    return Math.sqrt(vec2.dot2(a))
  },

  normalizeeq: (a) => {
    return vec2.diveqs(a, vec2.length(a))
  },

  normalize: (a) => {
    return vec2.normalizeeq(vec2.clone(a))
  },

  clone: (a) => {
    return [a[0], a[1]]
  },

  matmuleq: (m, a) => {
    const m00 = m[0]
    const m10 = m[1]
    const m01 = m[2]
    const m11 = m[3]
    const a0 = a[0]
    const a1 = a[1]
    a[0] = m00 * a0 + m01 * a1
    a[1] = m10 * a0 + m11 * a1
    return a
  },

  matmul: (m, a) => {
    return vec2.matmuleq(m, vec2.clone(a))
  }
}

const mat2 = {
  ...generateOperators('add', (lhs, rhs) => `${lhs} + ${rhs}`, 4),
  ...generateOperators('sub', (lhs, rhs) => `${lhs} - ${rhs}`, 4),
  ...generateOperators('mul', (lhs, rhs) => `${lhs} * ${rhs}`, 4),
  ...generateOperators('div', (lhs, rhs) => `${lhs} / ${rhs}`, 4),

  toMat3: (a) => {
    return [
      a[0], a[1], 0,
      a[2], a[3], 0,
      0, 0, 1
    ]
  },

  eye: () => {
    return [1, 0, 0, 1]
  },

  outer: (a, b) => {
    return [
      a[0] * b[0], a[1] * b[0],
      a[0] * b[1], a[1] * b[1]
    ]
  },

  outer2: (a) => {
    return mat2.outer(a, a)
  },

  transpose: (a) => {
    const a00 = a[0]
    const a10 = a[1]
    const a01 = a[2]
    const a11 = a[3]
    return [a00, a01, a10, a11]
  },

  matmul: (a, b) => {
    const a00 = a[0]
    const a10 = a[1]
    const a01 = a[2]
    const a11 = a[3]
    const b00 = b[0]
    const b10 = b[1]
    const b01 = b[2]
    const b11 = b[3]
    const c00 = a00 * b00 + a01 * b10
    const c10 = a10 * b00 + a11 * b10
    const c01 = a00 * b01 + a01 * b11
    const c11 = a10 * b01 + a11 * b11
    return [c00, c10, c01, c11]
  },

  det: (m) => {
    return m[0] * m[3] - m[1] * m[2]
  },

  diag: (a) => {
    return [a[0], 0, 0, a[1]]
  },

  kernelSym: (A) => {
    // Assume A: symmetric and not invertible
    const a = A[0]
    const b = A[1]
    const { abs, sqrt } = Math

    // a d - b^2 = 0
    if (abs(b) < 1e-7) { // b = 0
      // a = 0 or d = 0
      if (abs(a) < 1e-7) { // a = 0
        return [1, 0]
      }
      // d = 0
      return [0, 1]
    }

    // a != 0 and d != 0
    const s = sqrt(a * a + b * b)
    return [b / s, -a / s]
  },

  // A = U D U^T
  eigenSym: (A) => {
    // Assume A: symmetric
    const a = A[0]
    const b = A[1]
    const d = A[3]
    const { abs, sqrt } = Math

    // Check if already diagonal
    if (abs(b) < 1e-7) {
      return [
        [1, 0, 0, 1], // U
        [a, d] // D
      ]
    }

    // Get (distinct) eigen values as deg-2 poly roots
    const p = (a + d)
    const q = sqrt((a - d) * (a - d) + 4 * b * b) // q > 0 since b != 0
    const e0 = (p + q) / 2
    const e1 = (p - q) / 2

    // Get eigen vectors (orthogonal since eigen values are distinct)
    const { addeq, diag, kernelSym } = mat2
    const u0 = kernelSym(addeq(diag([-e0, -e0]), A))
    const u1 = kernelSym(addeq(diag([-e1, -e1]), A))

    return [
      [u0[0], u0[1], u1[0], u1[1]], // U
      [e0, e1] // D
    ]
  },

  svdInvertible: (A) => {
    // B = AT A                         [positive definite]
    //   = P S PT                       [diagonalization]
    // C = sqrt(B) = P sqrt(S) PT
    // A = (A C^-1) C                   [polar decomposition]
    //   = ((A C^-1) P) sqrt(S) PT      [svd]
    //   = (A P sqrt(S^-1)) sqrt(S) PT
    //      ~~~~~~~~~~~~~ U  ~~~ D  ~~ VT

    const { matmul, transpose, diag, eigenSym } = mat2
    const { sqrt, reciprocal } = vec2

    const B = matmul(transpose(A), A)
    const [P, S] = eigenSym(B)
    const D = sqrt(S)
    const invD = reciprocal(D)
    const U = matmul(A, matmul(P, diag(invD)))
    const VT = transpose(P)
    return [U, D, VT]
  },

  svdUpperTriangle: (A) => {
    const { abs, sqrt } = Math
    const a = A[0]
    const b = A[2]
    const d = A[3]

    // A = a 0
    //     0 d
    if (abs(b) < 1e-7) {
      const U = [
        1, 0,
        0, 1
      ]
      const D = [a, d]
      const VT = [
        1, 0,
        0, 1
      ]
      return [U, D, VT]
    }

    // A = a b
    //     0 0
    if (abs(d) < 1e-7) {
      const l = sqrt(a * a + b * b)
      const p = a / l
      const q = b / l
      const U = [
        1, 0,
        0, 1
      ]
      const D = [l, 0]
      const VT = [
        p, -q,
        q, p
      ]
      return [U, D, VT]
    }

    // A = 0 b
    //     0 d
    if (abs(d) < 1e-7) {
      const l = sqrt(b * b + d * d)
      const p = b / l
      const q = d / l
      const U = [
        -p, q,
        p, q
      ]
      const D = [l, 0]
      const VT = [
        0, 1,
        1, 0
      ]
      return [U, D, VT]
    }

    // A: invertible
    return mat2.svdInvertible(A)
  },

  householderQR: (A) => {
    const { abs } = Math
    const { eye, subeq, muleqs, outer2, matmul } = mat2

    const c = A[1]
    if (abs(c) < 1e-7) {
      return [mat3.eye(), A]
    }

    const a = A[0]
    const l = Math.sqrt(a * a + c * c)
    const h = vec2.normalizeeq(vec2.subeq([a, c], [l, 0]))
    const H = subeq(eye(), muleqs(outer2(h), 2)) // I - 2 h h^T
    const B = matmul(H, A)
    return [H, B]
  },

  // If A is known to be invertible, then we can use `svdInvertible` directly.
  svd: (A) => {
    if (Math.abs(A[1]) < 1e-7) {
      return mat2.svdUpperTriangle(A)
    }
    const [Q, R] = mat2.householderQR(A)
    const [U, D, VT] = mat2.svdUpperTriangle(R)
    return [mat2.matmul(Q, U), D, VT]
  }
}

const mat3 = {
  ...generateOperators('add', (lhs, rhs) => `${lhs} + ${rhs}`, 9),
  ...generateOperators('sub', (lhs, rhs) => `${lhs} - ${rhs}`, 9),
  ...generateOperators('mul', (lhs, rhs) => `${lhs} * ${rhs}`, 9),
  ...generateOperators('div', (lhs, rhs) => `${lhs} / ${rhs}`, 9),

  toMat2: (a) => {
    return [
      a[0], a[1],
      a[3], a[4]
    ]
  },

  diag: (a) => {
    return [
      a[0], 0, 0,
      0, a[1], 0,
      0, 0, a[2]
    ]
  },

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

  frameX: (x) => {
    const tmp = Math.abs(x[0]) < 0.5 ? [1, 0, 0] : [0, 1, 0]
    const z = vec3.normalizeeq(vec3.cross(x, tmp))
    return mat3.frameXZ(x, z)
  },

  frameZ: (z) => {
    const tmp = Math.abs(z[0]) < 0.5 ? [1, 0, 0] : [0, 1, 0]
    const x = vec3.normalizeeq(vec3.cross(z, tmp))
    return mat3.frameXZ(x, z)
  },

  frameXZ: (x, z) => {
    const y = vec3.cross(z, x)
    return [
      x[0], x[1], x[2],
      y[0], y[1], y[2],
      z[0], z[1], z[2]
    ]
  },

  det: (a) => {
    const a00 = a[0]
    const a10 = a[1]
    const a20 = a[2]
    const a01 = a[3]
    const a11 = a[4]
    const a21 = a[5]
    const a02 = a[6]
    const a12 = a[7]
    const a22 = a[8]
    const b00 = a11 * a22 - a21 * a12
    const b10 = a21 * a02 - a01 * a22
    const b20 = a01 * a12 - a11 * a02
    const det = a00 * b00 + a10 * b10 + a20 * b20
    return det
  },

  inverse: (a) => {
    // Inverse via cofactor
    const a00 = a[0]
    const a10 = a[1]
    const a20 = a[2]
    const a01 = a[3]
    const a11 = a[4]
    const a21 = a[5]
    const a02 = a[6]
    const a12 = a[7]
    const a22 = a[8]
    const b00 = a11 * a22 - a21 * a12
    const b10 = a21 * a02 - a01 * a22
    const b20 = a01 * a12 - a11 * a02
    const b01 = a12 * a20 - a22 * a10
    const b11 = a22 * a00 - a02 * a20
    const b21 = a02 * a10 - a12 * a00
    const b02 = a10 * a21 - a20 * a11
    const b12 = a20 * a01 - a00 * a21
    const b22 = a00 * a11 - a10 * a01
    const det = a00 * b00 + a10 * b10 + a20 * b20
    return [
      b00 / det, b01 / det, b02 / det,
      b10 / det, b11 / det, b12 / det,
      b20 / det, b21 / det, b22 / det
    ]
  },

  transpose: (a) => {
    const a00 = a[0]
    const a10 = a[1]
    const a20 = a[2]
    const a01 = a[3]
    const a11 = a[4]
    const a21 = a[5]
    const a02 = a[6]
    const a12 = a[7]
    const a22 = a[8]
    return [
      a00, a01, a02,
      a10, a11, a12,
      a20, a21, a22
    ]
  },

  matmul: (a, b) => {
    const a00 = a[0]
    const a10 = a[1]
    const a20 = a[2]
    const a01 = a[3]
    const a11 = a[4]
    const a21 = a[5]
    const a02 = a[6]
    const a12 = a[7]
    const a22 = a[8]
    const b00 = b[0]
    const b10 = b[1]
    const b20 = b[2]
    const b01 = b[3]
    const b11 = b[4]
    const b21 = b[5]
    const b02 = b[6]
    const b12 = b[7]
    const b22 = b[8]
    const c00 = a00 * b00 + a01 * b10 + a02 * b20
    const c10 = a10 * b00 + a11 * b10 + a12 * b20
    const c20 = a20 * b00 + a21 * b10 + a22 * b20
    const c01 = a00 * b01 + a01 * b11 + a02 * b21
    const c11 = a10 * b01 + a11 * b11 + a12 * b21
    const c21 = a20 * b01 + a21 * b11 + a22 * b21
    const c02 = a00 * b02 + a01 * b12 + a02 * b22
    const c12 = a10 * b02 + a11 * b12 + a12 * b22
    const c22 = a20 * b02 + a21 * b12 + a22 * b22
    return [c00, c10, c20, c01, c11, c21, c02, c12, c22]
  },

  householderQR: (A) => {
    const { abs } = Math
    const { eye, subeq, muleqs, outer2, matmul } = mat3

    let Q = eye()
    let B = A

    // 1st column
    if (!(abs(B[1]) < 1e-7 && abs(B[2]) < 1e-7)) {
      const v = [B[0], B[1], B[2]]
      const l = vec3.length(v)
      const h = vec3.normalizeeq(vec3.subeq(v, [l, 0, 0]))
      const H = subeq(eye(), muleqs(outer2(h), 2)) // I - 2 h h^T
      B = matmul(H, B)
      Q = H
    }

    // 2nd column
    if (!(abs(B[5]) < 1e-7)) {
      const v = [B[4], B[5]]
      const l = vec2.length(v)
      const h = vec2.normalizeeq(vec2.subeq(v, [l, 0]))
      // I - 2 h h^T
      const H = [
        1, 0, 0,
        0, 1 - 2 * h[0] * h[0], 0 - 2 * h[0] * h[1],
        0, 0 - 2 * h[0] * h[1], 1 - 2 * h[1] * h[1]
      ]
      B = matmul(H, B)
      Q = matmul(H, Q)
    }

    return [mat3.transpose(Q), B]
  },

  kernel: (A) => {
    // Assume A: non invertible
    const { abs } = Math
    const [Q, R] = mat3.householderQR(A) // eslint-disable-line

    // Since R non invertible, some diagonal is zero
    // R = a b c
    //       d e
    //         f
    const a = R[0]
    const b = R[3]
    const c = R[6]
    const d = R[4]
    const e = R[7]
    const f = R[8] // eslint-disable-line

    // a = 0
    if (abs(a) < 1e-7) {
      return [1, 0, 0]
    }

    // d = 0
    if (abs(d) < 1e-7) {
      const y = 1
      const x = -b / a
      return vec3.normalizeeq([x, y, 0])
    }

    // f = 0
    const z = 1
    const y = -e / d
    const x = -(b * y + c * z) / a
    return vec3.normalizeeq([x, y, z])
  },

  eigenSymWithKnownEigenvalue: (A, e) => {
    const { addeq, diag, matmul, transpose } = mat3

    // Eigen vector
    const u = mat3.kernel(addeq(diag([-e, -e, -e]), A))

    // Use mat2.eigenSym for orthogonal space of eigen vector u
    const Uu = mat3.frameZ(u)
    const B = matmul(transpose(Uu), matmul(A, Uu))
    const [Ub, Db] = mat2.eigenSym(mat3.toMat2(B))

    // Back to mat3
    const U = matmul(Uu, mat2.toMat3(Ub))
    const D = [Db[0], Db[1], e]
    return [U, D]
  },

  eigenvaluePSD: (A) => {
    // Find smallest cubic root by Newton method
    // Since Positive semi definite, we can always start from x = 0 and reach smallest.
    // f  = - x^3 + p x^2 + q x + r
    // f' = - 3 x^2 + 2 p x + q

    // [ Symbolic computation by sympy ]
    // >>> from sympy import symbols, expand, collect
    // >>> x = symbols('x')
    // >>> [a00, a01, a02], [a10, a11, a12], [a20, a21, a22] = [[symbols('a' + str(i) + str(j)) for j in range(3)] for i in range(3)]
    // >>> p = (a00 - x) * ((a11 - x) * (a22 - x) - a21 * a12) + \
    //     a10 * (a21 * a02 - a01 * (a22 - x)) + \
    //     a20 * (a01 * a12 - (a11 - x) * a02)
    // >>> print(collect(expand(p), x))
    // a00*a11*a22 - a00*a12*a21 - a01*a10*a22 + a01*a12*a20 + a02*a10*a21 - a02*a11*a20 - x**3 + x**2*(a00 + a11 + a22) + x*(-a00*a11 - a00*a22 + a01*a10 + a02*a20 - a11*a22 + a12*a21)

    const a00 = A[0]
    const a10 = A[1]
    const a20 = A[2]
    const a01 = A[3]
    const a11 = A[4]
    const a21 = A[5]
    const a02 = A[6]
    const a12 = A[7]
    const a22 = A[8]
    const p = a00 + a11 + a22
    const q = -a00 * a11 - a00 * a22 + a01 * a10 + a02 * a20 - a11 * a22 + a12 * a21
    const r = a00 * a11 * a22 - a00 * a12 * a21 - a01 * a10 * a22 + a01 * a12 * a20 + a02 * a10 * a21 - a02 * a11 * a20

    let x = 0
    const N = 10 // Believe this is enough since quadratic convergence
    for (let i = 0; i < N; i++) {
      const x3 = x ** 3
      const x2 = x ** 2
      const f = -x3 + p * x2 + q * x + r
      if (Math.abs(f) < 1e-7) {
        return x
      }
      const df = -3 * x2 + 2 * p * x + q
      x -= f / df
    }
    throw new Error('[mat3.eigenvaluePSD] Newton method failed')
  },

  eigenPSD: (A) => {
    const e = mat3.eigenvaluePSD(A)
    return mat3.eigenSymWithKnownEigenvalue(A, e)
  },

  svdInvertible: (A) => {
    // Cf. mat2.svdInvertible (same strategy is used here)
    const { matmul, transpose, diag } = mat3
    const { sqrt, reciprocal } = vec3

    const B = matmul(transpose(A), A)
    const [P, S] = mat3.eigenPSD(B)
    const D = sqrt(S)
    const invD = reciprocal(D)
    const U = matmul(A, matmul(P, diag(invD)))
    const VT = transpose(P)
    return [U, D, VT]
  },

  svdNonInvertible: (A) => {
    const { matmul, transpose } = mat3

    // Reduce to mat2.svd
    const AT = mat3.transpose(A)
    const u1 = mat3.kernel(A)
    const u2 = mat3.kernel(AT)
    const U1 = mat3.frameZ(u1)
    const U2 = mat3.frameZ(u2)
    const U1T = transpose(U1)
    const U2T = transpose(U2)

    // B = U2^T  A U1 = ? ? 0
    //                  ? ? 0
    //                  0 0 0
    const B = matmul(U2T, matmul(A, U1))
    const [Ub, Db, VTb] = mat2.svd(mat3.toMat2(B))

    // Back to mat3
    const U = matmul(U2, mat2.toMat3(Ub))
    const D = [Db[0], Db[1], 0]
    const VT = matmul(mat2.toMat3(VTb), U1T)
    return [U, D, VT]
  },

  svd: (A) => {
    if (Math.abs(mat3.det(A)) < 1e-7) {
      return mat3.svdNonInvertible(A)
    }
    return mat3.svdInvertible(A)
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

export { scalar, vec2, vec3, mat2, mat3, quat }
