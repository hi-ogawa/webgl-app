/* global describe, it */

const { performance } = require('perf_hooks')
const { requireEm } = require('../utils.js')

const sum = (data) => {
  let result = 0
  for (let i = 0; i < data.length; i++) {
    result += data[i]
  }
  return result
}

const measure = (func, r = 32) => {
  const t0 = performance.now()
  for (let i = 0; i < r; i++) {
    func()
  }
  const t1 = performance.now()
  return ((t1 - t0) / 1000) / r
}

describe('wasm', () => {
  describe('ex04', () => {
    it('works', async () => {
      const { Vectorf } = await requireEm('./ex04/build/Release/em.js') // relative to ./utils.js
      const a = new Vectorf()
      a.resize(2 ** 24, 1)
      const data = a.data()
      console.log('sum_parallel:', measure(() => a.sum_parallel()))
      console.log('sum:         ', measure(() => a.sum()))
      console.log('sum (js):    ', measure(() => sum(data)))
      a.delete()
    })
  })
})
