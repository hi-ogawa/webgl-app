/* eslint camelcase: 0 */

class Matrix2 {
  constructor () {
    Object.assign(this, {
      isMatrix2: true,
      elements: [1, 0, 0, 1]
    })
  }

  toArray () {
    return [...this.elements]
  }

  clone () {
    const m = new Matrix2()
    m.elements = [...this.elements]
    return m
  }

  multiplyScalar (s) {
    this.elements = this.elements.map(e => s * e)
    return this
  }

  multiplyMatrices (m1, m2) {
    const [a1, c1, b1, d1] = m1.elements
    const [a2, c2, b2, d2] = m2.elements
    this.elements = [
      a1 * a2 + b1 * c2, c1 * a2 + d1 * c2,
      a1 * b2 + b1 * d2, c1 * b2 + d1 * d2
    ]
    return this
  }

  getInverse (m) {
    const [a, c, b, d] = m.elements
    const det = a * d - b * c
    this.elements = [d, -c, -b, a].map(x => x / det)
    return this
  }

  transpose () {
    const [a, c, b, d] = this.elements
    this.elements = [a, b, c, d]
    return this
  }
}

const Vector2_applyMatrix2 = (v, m) => {
  const [a, c, b, d] = m.elements;
  [v.x, v.y] = [
    a * v.x + b * v.y,
    c * v.x + d * v.y
  ]
  return v
}

export {
  Matrix2, Vector2_applyMatrix2
}
