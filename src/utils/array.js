// Cf.
// - https://github.com/scijs/ndarray/blob/master/test/test.js
// - https://github.com/scijs/ndarray-ops/blob/master/ndarray-ops.js

import _ from '../../web_modules/lodash.js'

const makeRawMajorStride = (a) => {
  const l = a.length
  return _.range(l).map(i => a.slice(1, l - i).reduce(_.multiply, 1))
}

class NdArray {
  constructor (data, shape, offset) {
    this.data = data
    this.shape = shape
    this.offset = offset
    this.ndim = this.shape.length
    this.size = this.shape.reduce(_.multiply)
    this.stride = makeRawMajorStride(this.shape)
  }

  static empty (shape, Klass = Float32Array) {
    const size = shape.reduce(_.multiply)
    const data = new Klass(size)
    return new Matrix(data, shape, 0)
  }

  index (...args) {
    let result = this.offset
    for (let i = 0; i < this.ndim; i++) {
      result += this.stride[i] * args[i]
    }
    return result
  }

  get (...args) {
    return this.data[this.index(...args)]
  }

  set (...args) {
    const v = args.pop()
    this.data[this.index(...args)] = v
  }
}

class Matrix {
  constructor (data, shape, offset) {
    this.data = data
    this.shape = shape
    this.offset = offset
  }

  static empty (shape, Klass = Float32Array) {
    const [n, m] = shape
    const data = new Klass(n * m)
    return new Matrix(data, shape, 0)
  }

  index (i, j) {
    return this.offset + this.shape[1] * i + j
  }

  get (i, j) {
    return this.data[this.index(i, j)]
  }

  set (i, j, v) {
    this.data[this.index(i, j)] = v
  }

  pick (i) {
    const m = this.shape[1]
    const offset = this.index(i, 0)
    return new Matrix(this.data, [1, m], offset)
  }
}

export { NdArray, Matrix }
