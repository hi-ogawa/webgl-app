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
    this.dtype = data.constructor
  }

  static empty (shape, Klass = Float32Array) {
    const size = shape.reduce(_.multiply)
    const data = new Klass(size)
    return new NdArray(data, shape, 0)
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

  incr (...args) {
    const v = args.pop()
    this.data[this.index(...args)] += v
  }
}

class Matrix {
  constructor (data, shape) {
    this.data = data
    this.shape = shape
    this.size = shape.reduce(_.multiply)
  }

  static empty (shape, Klass = Float32Array) {
    const data = new Klass(shape.reduce(_.multiply))
    return new Matrix(data, shape)
  }

  clone () {
    const other = Matrix.empty(this.shape, this.data.constructor)
    other.data.set(this.data)
    return other
  }

  copy (other) {
    this.data.set(other.data)
    return this
  }

  index (i, j) {
    return this.shape[1] * i + j
  }

  get (i, j) {
    return this.data[this.index(i, j)]
  }

  set (i, j, v) {
    this.data[this.index(i, j)] = v
  }

  row (i) {
    const offset = this.index(i, 0)
    const m = this.shape[1]
    return this.data.subarray(offset, offset + m)
  }

  forEach (func) {
    for (let i = 0; i < this.shape[0]; i++) {
      for (let j = 0; j < this.shape[1]; j++) {
        func(this.get(i, j), i, j)
      }
    }
  }

  incr (i, j, v) {
    this.data[this.index(i, j)] += v
  }

  transpose () {
    const data = new this.data.constructor(this.size)
    const [n, m] = this.shape
    const result = new Matrix(data, [m, n])
    this.forEach((v, i, j) => result.set(j, i, v))
    return result
  }

  subeq (other) {
    other.forEach((v, i, j) => { this.incr(i, j, -v) })
    return this
  }

  // Hilbert-Schmidt inner product Tr[AT A]
  dotHS (other) {
    let x = 0
    this.forEach((v, i, j) => { x += v * other.get(i, j) })
    return x
  }

  dotHS2 () { return this.dotHS(this) }
}

class Vector {}

// COOrdinate format (cf. https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.coo_matrix.html)
class MatrixCOO {
  constructor (data, row, col, shape, nnz, nnzMax) {
    this.data = data
    this.row = row
    this.col = col
    this.shape = shape
    this.nnz = nnz
    this.nnzMax = nnzMax
  }

  static empty (shape, nnzMax, Klass = Float32Array) {
    const data = new Klass(nnzMax)
    const row = new Uint32Array(nnzMax)
    const col = new Uint32Array(nnzMax)
    const result = new MatrixCOO(data, row, col, shape, 0, nnzMax)
    return result
  }

  toDense () {
    const result = Matrix.empty(this.shape, this.data.constructor)
    for (let i = 0; i < this.nnz; i++) {
      result.incr(this.row[i], this.col[i], this.data[i])
    }
    return result
  }

  get (i, j) { throw new Error('[MatrixCOO]') }

  set (i, j, v) {
    if (this.nnz >= this.nnzMax) {
      // TODO: Support increasing nnz
      throw new Error('[MatrixCOO]')
    }
    this.row[this.nnz] = i
    this.col[this.nnz] = j
    this.data[this.nnz] = v
    this.nnz++
  }

  // Y = A X
  matmul (y, x) {
    y.data.fill(0)
    for (let p = 0; p < this.nnz; p++) {
      const i = this.row[p]
      const j = this.col[p]
      const v = this.data[p]
      for (let k = 0; k < x.shape[1]; k++) {
        y.incr(i, k, v * x.get(j, k))
      }
    }
    return y
  }
}

// Compressed Sparse Column format (cf. https://docs.scipy.org/doc/scipy/reference/generated/scipy.sparse.csc_matrix.html)
class MatrixCSC {
  constructor (data, indices, indptr, shape) {
    this.data = data
    this.indices = indices
    this.indptr = indptr
    this.shape = shape
  }

  static fromCOO (a) {
    const b = new MatrixCSC()
    b.shape = a.shape

    const n = b.shape[0]
    b.indptr = new Uint32Array(n + 1)
    b.indices = new Uint32Array(a.nnz)
    b.data = new a.data.constructor(a.nnz)

    //
    // Radix sort where `row` is a supperior key over `col`
    //

    // Count non-zero column for each row
    const counts = new Uint32Array(n)
    for (let i = 0; i < a.nnz; i++) {
      counts[a.row[i]]++
    }

    // Construct `indptr` by cumsum
    for (let i = 0; i < n; i++) {
      b.indptr[i + 1] = b.indptr[i] + counts[i]
    }

    // Construct `data` and `indices`
    for (let i = 0; i < a.nnz; i++) {
      const r = a.row[i]
      counts[r]--
      const k = b.indptr[r] + counts[r]
      b.indices[k] = a.col[i]
      b.data[k] = a.data[i]
    }

    return b
  }

  // NOTE: convinient but not good for performance (cf. matmul below)
  forEach (onElement, onStartRow = () => {}, onEndRow = () => {}) {
    let p0 = 0
    for (let i = 0; i < this.shape[0]; i++) { // Loop A row
      const p1 = this.indptr[i + 1]
      onStartRow(i)
      for (let p = p0; p < p1; p++) { // Loop A col
        const j = this.indices[p]
        const v = this.data[p]
        onElement(v, i, j)
      }
      onEndRow(i)
      p0 = p1
    }
  }

  // returns `numDups` which is useful for `sumDuplicates`
  sortIndices () {
    const n = this.shape[0]
    const { indptr, indices, data } = this
    let numDups = 0

    let p0 = 0
    for (let i = 0; i < n; i++) { // Loop A row
      const p1 = indptr[i + 1]

      // For each column, apply insertion sort with counting duplicate key
      for (let p = p0 + 1; p < p1; p++) {
        let q = p
        while (p0 < q) {
          if (indices[q - 1] === indices[q]) { numDups++; break }
          if (indices[q - 1] < indices[q]) { break }

          const tmp1 = indices[q - 1]
          indices[q - 1] = indices[q]
          indices[q] = tmp1

          const tmp2 = data[q - 1]
          data[q - 1] = data[q]
          data[q] = tmp2

          q--
        }
      }

      p0 = p1
    }

    return numDups
  }

  sumDuplicates () {
    const numDups = this.sortIndices()
    const newNnz = this.indices.length - numDups

    const n = this.shape[0]
    const newIndptr = new Uint32Array(n + 1)
    const newIndices = new Uint32Array(newNnz)
    const newData = new this.data.constructor(newNnz)

    let p0 = 0
    let newP = 0
    for (let i = 0; i < n; i++) { // Loop A row
      const p1 = this.indptr[i + 1]

      // Squash each column
      newIndices[newP] = this.indices[p0]
      newData[newP] = this.data[p0]
      for (let p = p0 + 1; p < p1; p++) {
        const j = this.indices[p]
        const v = this.data[p]
        if (j === newIndices[newP]) {
          newData[newP] += v
          continue
        }
        newP++
        newIndices[newP] = j
        newData[newP] = v
      }

      newP++
      newIndptr[i + 1] = newP
      p0 = p1
    }

    this.indptr = newIndptr
    this.indices = newIndices
    this.data = newData
  }

  static fromDense (a) {
    const b = new MatrixCSC()
    b.shape = a.shape

    const n = b.shape[0]
    b.indptr = new Uint32Array(n + 1)

    const indices = []
    const data = []
    for (let i = 0; i < b.shape[0]; i++) {
      let count = 0
      for (let j = 0; j < b.shape[1]; j++) {
        const v = a.get(i, j)
        if (v === 0) { continue }

        indices.push(j)
        data.push(v)
        count++
      }
      b.indptr[i + 1] = b.indptr[i] + count
    }

    b.indices = new Uint32Array(indices)
    b.data = new a.data.constructor(data)
    return b
  }

  clone () {
    const other = new MatrixCSC()
    other.shape = this.shape
    other.indptr = this.indptr.slice()
    other.indices = this.indices.slice()
    other.data = this.data.slice()
    return other
  }

  toDense () {
    const result = Matrix.empty(this.shape, this.data.constructor)
    let p0 = 0
    for (let i = 0; i < this.shape[0]; i++) { // Loop A row
      const p1 = this.indptr[i + 1]
      for (let p = p0; p < p1; p++) { // Loop A col
        const j = this.indices[p]
        const v = this.data[p]
        result.incr(i, j, v)
      }
      p0 = p1
    }
    return result
  }

  // Y = A X
  matmul (y, x) {
    y.data.fill(0)

    // NOTE: `forEach` makes it about 2 tiems slower
    // this.forEach((v, i, j) => {
    //   for (let k = 0; k < x.shape[1]; k++) { // Loop X col
    //     y.incr(i, k, v * x.get(j, k))
    //   }
    // })

    let p0 = 0
    for (let i = 0; i < this.shape[0]; i++) { // Loop A row
      const p1 = this.indptr[i + 1]
      for (let p = p0; p < p1; p++) { // Loop A col
        const j = this.indices[p]
        const v = this.data[p]
        for (let k = 0; k < x.shape[1]; k++) { // Loop X col
          y.incr(i, k, v * x.get(j, k))
        }
      }
      p0 = p1
    }
    return y
  }

  // A X = B
  stepGaussSeidel (x, b) {
    let p0 = 0
    for (let i = 0; i < this.shape[0]; i++) { // Loop A row
      const p1 = this.indptr[i + 1]

      for (let k = 0; k < x.shape[1]; k++) { // Loop X col
        let diag = 0
        let rhs = b.get(i, k)
        for (let p = p0; p < p1; p++) { // Loop A col
          const j = this.indices[p]
          const v = this.data[p]

          if (j === i) {
            diag += v
            continue
          }

          rhs -= v * x.get(j, k)
        }
        x.set(i, k, rhs / diag)
      }
      p0 = p1
    }
    return x
  }

  // I - h A
  // Assume A have non-zero diagonal and thus no change in structure
  idsubmuls (h) {
    let p0 = 0
    for (let i = 0; i < this.shape[0]; i++) { // Loop A row
      const p1 = this.indptr[i + 1]
      let diag = false
      for (let p = p0; p < p1; p++) { // Loop A col
        const j = this.indices[p]
        const v = this.data[p]

        if (i === j) {
          // Handle id's contribution only once
          if (diag) {
            this.data[p] = -h * v
            continue
          }

          diag = true
          this.data[p] = 1 - h * v
          continue
        }

        this.data[p] = -h * v
      }

      // Throw if A doesn't have diagonal entry
      if (!diag) {
        throw new Error('[MatrixCSC.idsubmuls]')
      }
      p0 = p1
    }
    return this
  }
}

export { Vector, NdArray, Matrix, MatrixCOO, MatrixCSC }
