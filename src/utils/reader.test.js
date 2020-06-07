/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import fs from 'fs'
import util from 'util'
import { readOFF } from './reader.js'

/* eslint-disable no-unused-vars */
const equal = assert.strictEqual
const deepEqual = assert.deepStrictEqual
const fsReadFile = util.promisify(fs.readFile)
const readFile = (f) => fsReadFile(f).then(buffer => buffer.toString())
/* eslint-enable no-unused-vars */

describe('readOFF', () => {
  it('works 0', async () => {
    // without boundary
    const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
    const { verts, f2v } = readOFF(data)
    equal(verts.length, 3485)
    equal(f2v.length, 6966)
  })

  it('works 1', async () => {
    // with boundary
    const data = await readFile('thirdparty/libigl-tutorial-data/camelhead.off')
    const { verts, f2v } = readOFF(data)
    equal(verts.length, 11381)
    equal(f2v.length, 22704)
  })
})
