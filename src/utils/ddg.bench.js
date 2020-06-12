/* eslint camelcase: 0 */
/* global describe, it */

import fs from 'fs'
import util from 'util'
import * as ddg from './ddg.js'
import { readOFF } from './reader.js'
import { timeit } from './timeit.js'

const fsReadFile = util.promisify(fs.readFile)
const readFile = (f) => fsReadFile(f).then(buffer => buffer.toString())

describe('ddg', () => {
  describe('computeTopology', () => {
    it('bunny', async () => {
      // 3485 6966
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const run = () => ddg.computeTopology(f2v, nV)
      const { resultString } = timeit('args.run()', '', '', { run }, 4)
      console.log(resultString)
    })

    it('camelhead', async () => {
      // 11381 22704
      const data = await readFile('thirdparty/libigl-tutorial-data/camelhead.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const run = () => ddg.computeTopology(f2v, nV)
      const { resultString } = timeit('args.run()', '', '', { run }, 4)
      console.log(resultString)
    })
  })

  describe('computeMore', () => {
    it('bunny', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const run = () => ddg.computeMore(verts, f2v, topology)
      const { resultString } = timeit('args.run()', '', '', { run }, 4)
      console.log(resultString)
    })

    it('camelhead', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/camelhead.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const run = () => ddg.computeMore(verts, f2v, topology)
      const { resultString } = timeit('args.run()', '', '', { run }, 4)
      console.log(resultString)
    })
  })
})
