const assert = require('assert')
const { requireEm } = require('./utils.js')

describe('wasm', () => {
  describe('ex00', () => {
    it('works', async () => {
      const { Matrix } = await requireEm('./ex00.em.js')
      const a = new Matrix(3, 3)
      const b = new Matrix(3, 1)
      a.data().set([
        0, 1, 2,
        3, 4, 5,
        6, 7, 8
      ])
      b.data().set([2, 3, 5])

      const c = new Matrix(3, 1)
      Matrix.matmul_(a, b, c)
      assert.deepStrictEqual(c.data(), new Float32Array([3 + 10, 6 + 12 + 25, 12 + 21 + 40]))

      a.delete()
      b.delete()
      c.delete()
    })
  })
})
