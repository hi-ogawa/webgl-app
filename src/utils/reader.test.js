/* eslint camelcase: 0 */
/* global describe, it */

import assert from 'assert'
import fs from 'fs'
import util from 'util'
import _ from '../../web_modules/lodash.js'
import { readOFF, readOBJ, readMESH, readELENODE } from './reader.js'
import { equal, deepEqual, deepCloseTo } from './test-misc.js'
import * as glm from './glm.js'

/* eslint-disable no-unused-vars */
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

describe('readOBJ', () => {
  it('works 0', async () => {
    const data = await readFile('thirdparty/libigl-tutorial-data/cube.obj')
    const { verts, f2v } = readOBJ(data)
    equal(verts.length, 8)
    equal(f2v.length, 12)
  })

  it('works 1', async () => {
    const data = await readFile('thirdparty/libigl-tutorial-data/face.obj')
    const { verts, f2v } = readOBJ(data)
    equal(verts.length, 25905)
    equal(f2v.length, 51712)
  })
})

describe('readMESH', () => {
  it('works 0', async () => {
    const data = await readFile('thirdparty/libigl-tutorial-data/bunny.mesh')
    const { verts, f2v, c3xc0 } = readMESH(data)
    deepEqual(verts.shape, [5433, 3])
    deepEqual(f2v.shape, [6966, 3])
    deepEqual(c3xc0.shape, [34055, 4])
    assert(f2v.data.every(i => i >= 0 && i < 5433))
    assert(c3xc0.data.every(i => i >= 0 && i < 5433))

    const nV = verts.shape[0]
    const rows = _.range(nV).map(i => verts.row(i))
    const { add, min, max, divs } = glm.vec3
    const center = divs(rows.reduce(add, [0, 0, 0]), nV)
    const bboxMax = rows.reduce(max, [-1e3, -1e3, -1e3])
    const bboxMin = rows.reduce(min, [+1e3, +1e3, +1e3])
    deepCloseTo(center, [-0.026, 0.089, 0.0089], 1e-2)
    deepCloseTo(bboxMax, [0.061, 0.18, 0.058], 1e-2)
    deepCloseTo(bboxMin, [-0.094, 0.032, -0.061], 1e-2)
  })
})

describe('readELENODE', () => {
  // TODO: for now just test with files out of this tree (cf. https://github.com/mattoverby/admm-elastic)
  it.skip('works 0', () => {
    const ele = fs.readFileSync('../../others/admm-elastic/samples/data/bunny_1124.ele').toString()
    const node = fs.readFileSync('../../others/admm-elastic/samples/data/bunny_1124.node').toString()
    const { verts, c3xc0 } = readELENODE(ele, node)
    deepEqual(verts.shape, [777, 3])
    deepEqual(c3xc0.shape, [2510, 4])

    const counts = new Uint8Array(verts.shape[0])
    c3xc0.data.forEach(v => counts[v]++)
    assert(counts.every(i => i > 0))
    assert(c3xc0.data.every(v => v >= 0 && v < verts.shape[0]))
  })
})
