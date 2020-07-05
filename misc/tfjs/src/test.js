/* global describe, it, assert */

import * as ex00 from './ex00.js'
import * as ex01 from './ex01.js'
import * as ex02 from './ex02.js'
import * as ex03 from './ex03.js'
import * as ex04 from './ex04.js'

describe('ex00', () => {
  it('works', async () => {
    const result = await ex00.main()
    assert.deepEqual(result.shape, [1, 1])
  })
})

describe('ex01', () => {
  it('works', async () => {
    const result = await ex01.main()
    const buffer = await result.buffer()
    assert.deepEqual(buffer.values, new Float32Array([1 + 1, 2 + 4, 3 + 9, 4 + 16]))
  })
})

describe('ex02', () => {
  it('works', async () => {
    await ex02.main()
  })
})

describe('ex03', () => {
  it('works', async () => {
    await ex03.main()
  })
})

describe('ex04', () => {
  it('works', async () => {
    await ex04.main()
  })
})
