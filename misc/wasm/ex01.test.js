const assert = require('assert')
const { requireEm } = require('./utils.js')

describe('wasm', () => {
  describe('ex01', () => {
    it('works', async () => {
      const { Matrix, MatrixCSR } = await requireEm('./ex01.em.js')
      const a = new MatrixCSR(4, 3, 5)
      // 0 1 0
      // 2 0 3
      // 4 0 0
      // 0 5 0
      a.indptr().set([0, 1, 3, 4, 5])
      a.indices().set([1, 0, 2, 0, 1])
      a.data().set([1, 2, 3, 4, 5])

      const b = new Matrix(3, 1)
      b.data().set([2, 3, 5])

      const c = MatrixCSR.matmul(a, b)
      assert.deepStrictEqual(c.data(), new Float32Array([3, 19, 8, 15]))

      a.delete()
      b.delete()
      c.delete()
    })
  })
})
