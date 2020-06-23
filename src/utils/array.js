/* eslint no-lone-blocks: 0 */

// Cf.
// - https://github.com/scijs/ndarray/blob/master/test/test.js
// - https://github.com/scijs/ndarray-ops/blob/master/ndarray-ops.js

import _ from '../../web_modules/lodash.js'

const makeRawMajorStride = (a) => {
  const l = a.length
  return _.range(l).map(i => a.slice(1, l - i).reduce(_.multiply, 1))
}

const assertf = (f) => {
  if (!f()) { throw new Error(f.toString().slice(6)) }
}

// Not used
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

  static emptyLike (other) {
    return Matrix.empty(other.shape, other.data.constructor)
  }

  reshape (shape) {
    if (shape[0] === -1) {
      shape[0] = this.size / shape[1]
    }
    if (shape[1] === -1) {
      shape[1] = this.size / shape[0]
    }
    return new Matrix(this.data, shape)
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

  sum () {
    let x = 0
    for (let i = 0; i < this.data.length; i++) {
      x += this.data[i]
    }
    return x
  }

  // TODO: generate more basic operations (cf. glm.generateOperators)
  muleq (other) {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] *= other.data[i]
    }
    return this
  }

  muleqs (h) {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] *= h
    }
    return this
  }

  diveq (other) {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] /= other.data[i]
    }
    return this
  }

  diveqs (other) {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] /= other
    }
    return this
  }

  addeq (other) {
    other.forEach((v, i, j) => { this.incr(i, j, v) })
    return this
  }

  addeqs (other) {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] += other
    }
    return this
  }

  subeq (other) {
    other.forEach((v, i, j) => { this.incr(i, j, -v) })
    return this
  }

  subeqs (h) {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] -= h
    }
    return this
  }

  // C = A B (Mostly for testing/debugging sparse matrix)
  matmul (b) {
    const a = this
    const c = Matrix.empty([a.shape[0], b.shape[1]], a.data.constructor)
    // assert a.shape[1] === b.shape[0]
    // assert a.data.constructor === b.data.constructor
    for (let i = 0; i < a.shape[0]; i++) {
      for (let j = 0; j < b.shape[1]; j++) {
        let x = 0
        for (let k = 0; k < a.shape[1]; k++) {
          x += a.get(i, k) * b.get(k, j)
        }
        c.set(i, j, x)
      }
    }
    return c
  }

  // Hilbert-Schmidt inner product Tr[AT A]
  dotHS (other) {
    let x = 0
    this.forEach((v, i, j) => { x += v * other.get(i, j) })
    return x
  }

  dotHS2 () { return this.dotHS(this) }

  static print (a) {
    return _.chunk(a.data, a.shape[1]).map(row => row.join(' ')).join('\n')
  }

  // V -> V1 x V2 (category theoretically)
  static stack (ms) {
    const m0 = ms[0]
    const shape0 = _.sum(ms.map(m => m.shape[0]))
    const shape1 = m0.shape[1]
    if (!ms.every(m => m0.shape[1] === shape1)) {
      throw new Error('[Matrix.stack]')
    }

    const a = Matrix.empty([shape0, shape1], m0.data.constructor)
    let row = 0
    for (const m of ms) {
      a.data.set(m.data, a.index(row, 0))
      row += m.shape[0]
    }
    return a
  }

  // V1 x V2 -> V3 x V4 (category theoretically)
  static stackDiagonal (ms) {
    const shape0 = _.sum(ms.map(m => m.shape[0]))
    const shape1 = _.sum(ms.map(m => m.shape[1]))
    const a = Matrix.empty([shape0, shape1], ms[0].data.constructor)
    let row = 0
    let col = 0
    for (const m of ms) {
      m.forEach((v, i, j) => a.set(row + i, col + j, v))
      row += m.shape[0]
      col += m.shape[1]
    }
    return a
  }
}

// TODO: For now, we use Matrix with shape [n, 1]
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

  static fromCSC (A) {
    const nnz = A.indptr[A.shape[1]]
    const B = MatrixCOO.empty(A.shape, nnz, A.data.constructor)
    let p = 0
    for (let j = 0; j < A.shape[1]; j++) { // Loop A col
      for (; p < A.indptr[j + 1]; p++) {
        const i = A.indices[p]
        const Aij = A.data[p]
        B.set(i, j, Aij)
      }
    }
    return B
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

const splitByIndptr = (indptr, sth, subarray = false) => {
  const convert = subarray ? () => {} : Array.from
  return _.range(indptr.length - 1).map(i =>
    convert(sth.subarray(indptr[i], indptr[i + 1])))
}

class MatrixCSR {
  constructor (data, indices, indptr, shape) {
    this.data = data
    this.indices = indices
    this.indptr = indptr
    this.shape = shape
  }

  nnz () { return this.indptr[this.shape[0]] }

  static empty (shape, nnzMax, Klass = Float32Array) {
    const a = new MatrixCSR()
    a.shape = shape
    a.indptr = new Uint32Array(shape[0] + 1)
    a.indices = new Uint32Array(nnzMax)
    a.data = new Klass(nnzMax)
    return a
  }

  static fromCOO (a) {
    const b = new MatrixCSR()
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
    const newNnz = this.indptr[this.shape[0]] - numDups

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
    const b = new MatrixCSR()
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

  static fromDiagonal (data) {
    const A = new MatrixCSR()
    const N = data.length
    A.shape = [N, N]
    A.indptr = new Uint32Array(N + 1)
    A.indices = new Uint32Array(N)
    A.data = data
    for (let i = 0; i < N; i++) {
      A.indptr[i + 1] = i + 1
      A.indices[i] = i
    }
    return A
  }

  clone () {
    const other = new MatrixCSR()
    other.shape = this.shape.slice()
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

  gaussSeidel (x, b, iteration) {
    for (let i = 0; i < iteration; i++) {
      this.stepGaussSeidel(x, b)
    }
  }

  // I - h A (useful for implicit method for PDE)
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
        throw new Error('[MatrixCSR.idsubmuls]')
      }
      p0 = p1
    }
    return this
  }

  // - A + h I (useful for making negative semi-definite into positive definite)
  negadddiags (h) {
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
            this.data[p] = -v
            continue
          }

          diag = true
          this.data[p] = -v + h
          continue
        }

        this.data[p] = -v
      }

      // Throw if A doesn't have diagonal entry
      if (!diag) {
        throw new Error('[MatrixCSR.negadddiags]')
      }
      p0 = p1
    }
    return this
  }

  // Cf. Timothy A. Davis's LDL paper https://dl.acm.org/doi/10.1145/1114268.1114277
  // Key Lemma
  // - Reverse elimination tree represents L's directed graph reachability
  // - Reverse elimination tree topological sorting gives L's directed graph topological sorting
  // Proof
  // - feels obvious by construction
  // TODO:
  // - LDLT (i.e. L with unit diagonal)
  // - Approximate minimum degree ordering (AMD)
  choleskyComputeV3 () {
    const A = this
    const N = A.shape[0]

    // 1.
    // - Elimination tree
    // - CSC counts
    const elimTree = new Int32Array(N)
    const visited = new Uint32Array(N)
    const cscCounts = new Uint32Array(N)
    {
      // Loop L row
      for (let k = 0; k < N; k++) {
        elimTree[k] = -1
        visited[k] = k
        cscCounts[k] = 1

        // Loop A[k, <k] (equivalently A[<k, k] since symmetric)
        for (let p = A.indptr[k]; p < A.indptr[k + 1]; p++) {
          const i0 = A.indices[p]
          if (i0 === k) { break }

          // Follow elimination tree
          for (let i = i0; visited[i] !== k; i = elimTree[i]) {
            if (elimTree[i] === -1) { elimTree[i] = k }
            visited[i] = k
            cscCounts[i]++
          }
        }
      }
    }

    // 2.
    // - CSC indptr from CSC count
    const cscIndptr = new Uint32Array(N + 1)
    for (let i = 0; i < N; i++) {
      cscIndptr[i + 1] = cscIndptr[i] + cscCounts[i]
    }

    // 3.
    // - CSC indices (previously separate pass, which seemed fine in terms of performance and code readability...)
    // - Lower triangle solve x N
    const cscIndices = new Uint32Array(cscIndptr[N])
    const cscData = new Float32Array(cscIndptr[N])
    {
      const rhs = new Float32Array(N)
      const topsort = new Uint32Array(N)

      // Loop L row
      for (let k = 0; k < N; k++) {
        visited[k] = k
        cscIndices[cscIndptr[k]] = k
        cscCounts[k] = 1

        let Lacc = 0
        let Akk = 0
        let tail = N // Push topsort elements from tail

        // Loop A row (fill rhs and obtain topsort)
        for (let p = A.indptr[k]; ; p++) {
          const i0 = A.indices[p]
          const Aki = A.data[p]
          if (i0 === k) {
            Akk = Aki
            break
          }

          let depth = 0

          // Follow elimination tree
          for (let i = i0; visited[i] !== k; i = elimTree[i]) {
            visited[i] = k

            // Save temporary order into head
            topsort[depth++] = i

            // Refresh rhs
            rhs[i] = 0

            // Set CSC index
            cscIndices[cscIndptr[i] + cscCounts[i]] = k
          }

          // Push to tail
          while (depth > 0) {
            topsort[--tail] = topsort[--depth]
          }

          // Fill rhs
          rhs[i0] = Aki
        }

        // Rest is similar to usual `solveCscL`

        for (; tail < N; tail++) {
          const i = topsort[tail]
          const Lii = cscData[cscIndptr[i]]

          // Set L[k, i]
          const Lki = rhs[i] / Lii
          cscData[cscIndptr[i] + cscCounts[i]++] = Lki
          Lacc += Lki ** 2

          // Subtract LT[i, k] factor (i.e. Lki) from rhs
          for (let p = cscIndptr[i]; ; p++) { // We don't check p < cscIndptr[i + 1] since "j >= k" always breaks
            const j = cscIndices[p]
            if (j >= k) { break }

            const Lji = cscData[p]
            rhs[j] -= Lji * Lki
          }
        }

        // Set L[k, k]
        const Lkk2 = Akk - Lacc
        if (Lkk2 < 0) {
          throw new Error('[choleskyComputeV3] Not positive definite')
        }
        const Lkk = Math.sqrt(Lkk2)
        cscData[cscIndptr[k]] = Lkk
      }
    }

    const L = new MatrixCSR() // NOTE: actually CSC
    L.shape = A.shape
    L.indptr = cscIndptr
    L.indices = cscIndices
    L.data = cscData
    return L
  }

  // Almost identical to choleskyComputeV3
  // A = L D L^T where L's diagonals are all "1"
  choleskyComputeV4 () {
    const A = this
    const N = A.shape[0]

    // 1.
    // - Elimination tree
    // - CSC counts
    const elimTree = new Int32Array(N)
    const visited = new Uint32Array(N)
    const cscCounts = new Uint32Array(N)
    {
      // Loop L row
      for (let k = 0; k < N; k++) {
        elimTree[k] = -1
        visited[k] = k
        cscCounts[k] = 1

        // Loop A[k, <k] (equivalently A[<k, k] since symmetric)
        for (let p = A.indptr[k]; p < A.indptr[k + 1]; p++) {
          const i0 = A.indices[p]
          if (i0 === k) { break }

          // Follow elimination tree
          for (let i = i0; visited[i] !== k; i = elimTree[i]) {
            if (elimTree[i] === -1) { elimTree[i] = k }
            visited[i] = k
            cscCounts[i]++
          }
        }
      }
    }

    // 2.
    // - CSC indptr from CSC count
    const cscIndptr = new Uint32Array(N + 1)
    for (let i = 0; i < N; i++) {
      cscIndptr[i + 1] = cscIndptr[i] + cscCounts[i]
    }

    // 3.
    // - CSC indices (previously separate pass, which seemed fine in terms of performance and code readability...)
    // - Lower triangle solve x N
    const cscIndices = new Uint32Array(cscIndptr[N])
    const cscData = new Float32Array(cscIndptr[N])
    const D = Matrix.empty([N, 1])
    {
      const rhs = new Float32Array(N)
      const topsort = new Uint32Array(N)

      // Loop L row
      for (let k = 0; k < N; k++) {
        visited[k] = k
        cscIndices[cscIndptr[k]] = k
        cscCounts[k] = 1

        let Lacc = 0
        let Akk = 0
        let tail = N // Push topsort elements from tail

        // Loop A row (fill rhs and obtain topsort)
        for (let p = A.indptr[k]; ; p++) {
          const i0 = A.indices[p]
          const Aki = A.data[p]
          if (i0 === k) {
            Akk = Aki
            break
          }

          let depth = 0

          // Follow elimination tree
          for (let i = i0; visited[i] !== k; i = elimTree[i]) {
            visited[i] = k

            // Save temporary order into head
            topsort[depth++] = i

            // Refresh rhs
            rhs[i] = 0

            // Set CSC index
            cscIndices[cscIndptr[i] + cscCounts[i]] = k
          }

          // Push to tail
          while (depth > 0) {
            topsort[--tail] = topsort[--depth]
          }

          // Fill rhs
          rhs[i0] = Aki
        }

        // Rest is similar to usual `solveCscL`

        for (; tail < N; tail++) {
          const i = topsort[tail]
          const Dii = D.data[i]

          // Set L[k, i]
          const Lki = rhs[i] / Dii
          cscData[cscIndptr[i] + cscCounts[i]++] = Lki
          Lacc += Dii * Lki ** 2

          // Subtract LT[i, k] factor from rhs
          for (let p = cscIndptr[i]; ; p++) { // We don't check p < cscIndptr[i + 1] since "j >= k" always breaks
            const j = cscIndices[p]
            if (j >= k) { break }

            const Lji = cscData[p]
            rhs[j] -= Lji * Dii * Lki
          }
        }

        // Set D[k, k]
        const Dkk = Akk - Lacc
        if (Dkk < 0) {
          throw new Error('[choleskyComputeV4] Not positive definite')
        }
        D.data[k] = Dkk

        // Set L[k, k]
        const Lkk = 1
        cscData[cscIndptr[k]] = Lkk
      }
    }

    const L = new MatrixCSR() // NOTE: actually CSC
    L.shape = A.shape
    L.indptr = cscIndptr
    L.indices = cscIndices
    L.data = cscData
    return { L, D }
  }

  // L L^T X = B
  choleskySolveV3 (x, b) {
    const y = Matrix.emptyLike(x)
    this.solveCscL(y, b) // L y = b
    this.solveCscLT(x, y) // L^T x = y
    return x
  }

  // L D L^T X = B
  choleskySolveV4 (x, D, b) {
    const L = this
    const y = Matrix.emptyLike(x)
    L.solveCscL(y, b) // L y = b
    y.diveq(D) // D y' = y
    L.solveCscLT(x, y) // L^T x = y'
    return x
  }

  // L X = B
  solveCscL (x, b) {
    const L = this
    const N = L.shape[0]
    const K = x.shape[1]

    const rhs = b.clone() // Update as X[i, k] is computed
    let p = 0
    for (let i = 0; i < N; i++) { // Loop L col
      const Lii = L.data[p]

      for (let k = 0; k < K; k++) { // Loop X col
        const Xik = rhs.get(i, k) / Lii
        x.set(i, k, Xik)

        // Subtract Xik factor from rhs
        for (; p < L.indptr[i + 1]; p++) { // Loop L row
          const j = L.indices[p]
          const Lji = L.data[p]
          rhs.incr(j, k, -Lji * Xik)
        }
      }
    }
    return x
  }

  // L^T X = B
  solveCscLT (x, b) {
    const L = this
    const N = L.shape[0]
    const K = x.shape[1]

    for (let i = N - 1; i >= 0; i--) { // Loop L^T row from bottom
      const p0 = L.indptr[i]
      const LTii = L.data[p0]

      for (let k = 0; k < K; k++) { // Loop X col
        let rhs = b.get(i, k)

        for (let p = p0; p < L.indptr[i + 1]; p++) { // Loop L^T col
          const j = L.indices[p]
          const LTij = L.data[p]
          rhs -= LTij * x.get(j, k)
        }
        x.set(i, k, rhs / LTii)
      }
    }
    return x
  }

  // C = A B
  // Time = \sum_i nnz(A[*, i]) . nnz(B[i, *])
  matmulCsr (B) {
    const A = this
    const C = new MatrixCSR()
    C.shape = [A.shape[0], B.shape[1]]
    assertf(() => A.shape[1] === B.shape[0])

    // TODO: Can we estimate "nnz"? (Found that Eigen uses "nnz(lhs*rhs) ~= nnz(lhs) + nnz(rhs)")
    C.indptr = new Uint32Array(C.shape[0] + 1)
    C.indices = []
    C.data = []

    for (let i = 0; i < A.shape[0]; i++) { // Loop A row
      C.indptr[i + 1] = C.indptr[i]

      for (let Ap = A.indptr[i]; Ap < A.indptr[i + 1]; Ap++) { // Loop A[i, *]
        const k = A.indices[Ap]
        const Aik = A.data[Ap]

        for (let Bp = B.indptr[k]; Bp < B.indptr[k + 1]; Bp++) { // Loop B[k, *]
          const j = B.indices[Bp]
          const Bkj = B.data[Bp]

          // Set C[i, j]
          C.indices.push(j)
          C.data.push(Aik * Bkj)
          C.indptr[i + 1]++
        }
      }
    }

    C.indices = new Uint32Array(C.indices)
    C.data = new Float32Array(C.data)
    C.sumDuplicates()
    return C
  }

  // NOTE: Thought it's possible to make CSR version of it but I found the algorithm doesn't work.
  //       But some interesting enough construction is here, so I'll leave it.
  choleskyComputeV2 () {
    const A = this
    const N = A.shape[0]

    // 1.
    // - elimination tree
    // - CSR indptr
    const elimTree = new Int32Array(N)
    const visited = new Uint32Array(N)
    const csrIndptr = new Uint32Array(N + 1)
    {
      // Loop L row
      for (let k = 0; k < N; k++) {
        visited[k] = k
        elimTree[k] = -1
        csrIndptr[k + 1] = csrIndptr[k] + 1

        // Loop A[k, <k] (equivalently A[<k, k] since symmetric)
        for (let p = A.indptr[k]; p < A.indptr[k + 1]; p++) {
          const i0 = A.indices[p]
          if (i0 === k) { break }

          // Follow elimination tree
          for (let i = i0; visited[i] !== k; i = elimTree[i]) {
            visited[i] = k
            if (elimTree[i] === -1) {
              elimTree[i] = k
            }
            csrIndptr[k + 1]++
          }
        }
      }
    }

    // 2.
    // - CSR indices by "reverse" elimTree topological order
    const csrIndices = new Uint32Array(csrIndptr[N])
    {
      // Loop L row
      for (let k = 0; k < N; k++) {
        visited[k] = k

        // We construct csrIndices from back
        let Lp = csrIndptr[k + 1] - 1
        csrIndices[Lp] = k
        Lp--

        // Loop A[k, <k] (equivalently A[<k, k] since symmetric)
        for (let p = A.indptr[k]; p < A.indptr[k + 1]; p++) {
          const i0 = A.indices[p]
          if (i0 === k) { break }

          let depth = 0

          // Follow elimination tree
          for (let i = i0; visited[i] !== k; i = elimTree[i]) {
            visited[i] = k

            // Wrong order which we correct below
            csrIndices[Lp] = i
            Lp--
            depth++
          }

          // Reverse between (Lp, Lp + depth]
          for (let i = 0; 2 * i + 1 < depth; i++) {
            const tmp = csrIndices[Lp + i + 1]
            csrIndices[Lp + i + 1] = csrIndices[Lp + depth - i]
            csrIndices[Lp + depth - i] = tmp
          }
        }

        // [ Debug ] total order trivially satisfies the order we want
        // csrIndices.subarray(csrIndptr[k], csrIndptr[k + 1]).sort()
      }
    }

    // 3.
    // - Lower triangle solve x N
    const csrData = new Float32Array(csrIndptr[N])
    {
      const rhs = new Float32Array(N)

      // Loop L row
      for (let k = 0; k < N; k++) {
        let Lacc = 0 // = |L[<k, k]|^2
        let Akk = 0
        rhs.fill(0)

        for (let p = A.indptr[k]; p < A.indptr[k + 1]; p++) {
          const i = A.indices[p]
          const Aki = A.data[p]
          if (i === k) {
            Akk = Aki
            break
          }

          rhs[i] = Aki
        }

        // Solve L[<k, <k] LT[<k, k] = A[<k, k]
        // where LT[i0, k] is the only non-zero entry
        for (let Lp = csrIndptr[k]; Lp < csrIndptr[k + 1]; Lp++) {
          const i = csrIndices[Lp]
          if (i === k) { break }

          // Loop L col to get \sum_{j < i} L[i, j] L[k, j]
          // by traversing two list L[i, <i] and L[k, <i] simultaneously
          // TODO: this is incorrect for non-sorted indices
          let pi = csrIndptr[i]
          let pk = csrIndptr[k]
          while (pi < csrIndptr[i + 1] && pk < Lp) {
            if (csrIndices[pi] === csrIndices[pk]) {
              rhs[i] -= csrData[pi] * csrData[pk]
              pi++
              pk++
            }
            if (csrIndices[pi] < csrIndices[pk]) {
              pi++
            }
            if (csrIndices[pi] > csrIndices[pk]) {
              pk++
            }
          }

          // Get L[i, i]
          const Lii = csrData[csrIndptr[i + 1] - 1]

          // Set L[k, i]
          const Lki = rhs[i] / Lii
          csrData[Lp] = Lki

          // Update Lacc
          Lacc += Lki ** 2
        }

        // Set L[k, k]
        const p = csrIndptr[k + 1] - 1
        csrData[p] = Math.sqrt(Akk - Lacc)
      }
    }

    const L = new MatrixCSR()
    L.shape = A.shape
    L.indptr = csrIndptr
    L.indices = csrIndices
    L.data = csrData
    return L
  }

  // L L^T = A
  // Assume sumDuplicates is done
  choleskyCompute () {
    const { sqrt } = Math

    const A = this
    const L = new MatrixCSR()

    // TODO: can we derive nice bound? or maybe experimentally?
    //       64 is just from bunny laplacian example
    let nnzReserve = 64 * A.data.length

    L.shape = this.shape
    L.indptr = new Uint32Array(L.shape[0] + 1)
    L.indices = new Uint32Array(nnzReserve)
    L.data = new Float32Array(nnzReserve)
    let Lp = 0 // = nnz

    const Lset = (i, j, v) => { // eslint-disable-line
      L.indices[Lp] = j
      L.data[Lp] = v
      Lp++
      if (nnzReserve <= Lp) {
        nnzReserve *= 2
        console.log(`[choleskyCompute] Reallocation ${nnzReserve}`)
        {
          const tmp = new Uint32Array(nnzReserve)
          tmp.set(L.indices)
          L.indices = tmp
        }
        {
          const tmp = new Float32Array(nnzReserve)
          tmp.set(L.data)
          L.data = tmp
        }
      }
    }

    const LfinishRow = (i) => {
      L.indptr[i + 1] = Lp
    }

    // L[0, 0] = sqrt(A[0, 0])
    const L00 = sqrt(A.data[0])
    Lset(0, 0, L00)
    LfinishRow(0)

    for (let n = 1; n < A.shape[0]; n++) { // Loop A row
      let Lacc = 0 // = |L[<n, n]|^2
      let Ap = A.indptr[n]

      // Solve L[<n, <n] L[<n, n] = A[<n, n]
      let j = A.indices[Ap] // Skip to first A[j, n] != 0
      for (; j < n; j++) {
        let rhs = 0

        // Check if there is A[j, n]
        if (A.indices[Ap] === j) {
          rhs += A.data[Ap]
          Ap++
        }

        // Loop L col to get \sum_i L[j, i] L[n, i]
        // by traversing two sorted list L[j, <j] and L[n, <j] simultaneously
        let pj = L.indptr[j]
        let pn = L.indptr[n]
        while (pj < L.indptr[j + 1] && pn < Lp) {
          if (L.indices[pj] === L.indices[pn]) {
            rhs -= L.data[pj] * L.data[pn]
            pj++
            pn++
          }
          if (L.indices[pj] < L.indices[pn]) {
            pj++
          }
          if (L.indices[pj] > L.indices[pn]) {
            pn++
          }
        }

        // Get L[j, j]
        // assertf(() => L.indices[L.indptr[j + 1] - 1] === j)
        const Ljj = L.data[L.indptr[j + 1] - 1]

        // [ Debug ]
        // console.log(`L[${n}, ${j}] rhs: ${rhs}, Ljj: ${Ljj}`)

        if (rhs === 0) { continue }

        const Lnj = rhs / Ljj
        Lacc += Lnj ** 2
        Lset(n, j, Lnj)
      }

      // Get Ann
      // assertf(() => Ap < A.indptr[n + 1])
      // assertf(() => A.indices[Ap] === n)
      const Ann = A.data[Ap]

      // [ Debug ]
      // console.log(`L[${n}, ${n}] Ann: ${Ann}, Lacc: ${Lacc}`)

      // L[n, n] = sqrt(A[n, n] - |L[<n, n]|^2)
      const Lnn2 = Ann - Lacc
      if (Lnn2 < 0) {
        throw new Error('choleskyCompute')
      }
      const Lnn = sqrt(Ann - Lacc)
      Lset(n, n, Lnn)
      LfinishRow(n)
    }

    return L
  }

  // Assume choleskyCompute is done
  choleskySolve (x, b) {
    const L = this
    const N = L.shape[0]
    const K = x.shape[1]
    const y = Matrix.emptyLike(x) // workspace

    // Solve L y = b
    {
      let p0 = 0
      for (let i = 0; i < N; i++) { // Loop L row
        const p1 = this.indptr[i + 1]

        // assert L.indices[p1 - 1] === i
        const Lii = L.data[p1 - 1]

        for (let k = 0; k < K; k++) { // Loop Y col
          let rhs = b.get(i, k)

          // Loop L col to get \sum_{j < i} L[i, j] Y[j, k]
          for (let p = p0; p < p1 - 1; p++) {
            const j = this.indices[p]
            const v = this.data[p]
            rhs -= v * y.get(j, k)
          }

          y.set(i, k, rhs / Lii)
        }

        p0 = p1
      }
    }

    // [ Debug ]
    // |L y - b| = 0
    // assertf(() => Math.abs(L.matmul(Matrix.emptyLike(y), y).subeq(b).dotHS2()) < 1e-6)

    // Solve LT x = y
    {
      const rhs = y.clone() // Update as X[i, k] is found
      let p = L.indptr[N] - 1
      for (let i = N - 1; i >= 0; i--) { // Loop LT row
        // assertf(() => L.indices[p] === i)
        const LTii = L.data[p]
        p--

        for (let k = 0; k < K; k++) { // Loop X col
          const Xik = rhs.get(i, k) / LTii
          x.set(i, k, Xik)

          // [ Debug ]
          // console.log(`X[${i}, ${k}]: ${Xik}, LT[${i}, ${i}]: ${LTii}, rhs: ${rhs.get(i, k)}`)

          const p0 = L.indptr[i]
          for (; p >= p0; p--) { // Loop LT row
            const j = L.indices[p]
            const LTji = L.data[p]

            rhs.incr(j, k, -LTji * Xik)

            // [ Debug ]
            // console.log(`LT[${j}, ${i}]: ${LTji}, rhs: ${rhs.get(j, k)}`)
          }
        }

        // [ Debug ]
        // if (i === N - 2) { break }
      }
    }

    // [ Debug ]
    // |LT x - y| = 0
    // const LTx = L.matmulT(Matrix.emptyLike(x), x)
    // console.log(LTx.clone().subeq(y).dotHS2())
    // console.log(_.zip(LTx.data, y.data).reverse())
    // assertf(() => LTx.clone().subeq(y).dotHS2() < 1e-6)

    return x
  }

  // Y = A^T X (i.e. CSC-matrix vector multiplication)
  // Used for debugging `choleskySolve`
  matmulT (y, x) {
    const A = this
    const N = A.shape[0]
    const K = x.shape[1]
    y.data.fill(0)

    let p = 0
    for (let i = 0; i < N; i++) { // Loop AT col (i.e. A row)
      const p1 = A.indptr[i + 1]
      for (; p < p1; p++) { // Loop AT row (i.e. A col)
        const j = A.indices[p]
        const Aij = A.data[p]
        for (let k = 0; k < K; k++) { // Loop X col
          y.incr(j, k, Aij * x.get(i, k))
        }
      }
    }
    return y
  }

  // A x = b
  // TODO: Write down proof of A-orthogonality
  conjugateGradient (x, b, iterLim = 1024, residueLim = 1e-3) {
    const A = this

    // r = A x - b
    const r = Matrix.emptyLike(x)
    A.matmul(r, x).subeq(b)

    let rDot = r.dotHS2()
    if (rDot < residueLim) {
      return { iteration: 0, residue: rDot }
    }

    const p = r.clone()
    const Ap = Matrix.emptyLike(p)

    for (let i = 0; i < iterLim; i++) {
      A.matmul(Ap, p)
      const pAp = p.dotHS(Ap)

      // alpha = - <r, r> / <p, A p>
      const alpha = -rDot / pAp

      // x' = x + alpha p
      x.forEach((v, i, j) => x.set(i, j, v + alpha * p.get(i, j)))

      // r' = r + alpha A p
      r.forEach((v, i, j) => r.set(i, j, v + alpha * Ap.get(i, j)))

      const _rDot = r.dotHS2()
      if (_rDot < residueLim) {
        return { iteration: i, residue: _rDot }
      }

      // beta = <r', r'> / <r, r>
      const beta = _rDot / rDot

      // p' = r' + beta p
      p.forEach((v, i, j) => p.set(i, j, r.get(i, j) + beta * v))

      rDot = _rDot
    }

    return { iteration: iterLim, residue: rDot }
  }
}

export { Vector, NdArray, Matrix, MatrixCOO, MatrixCSR, splitByIndptr }
