/* eslint camelcase: 0 */
/* global describe, it */

import fs from 'fs'
import util from 'util'
import * as ddg from './ddg.js'
import { readOFF } from './reader.js'
import { timeit } from './timeit.js'
import { Matrix, MatrixCSR } from './array.js'

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
  })

  describe('computeMoreV2', () => {
    it('bunny', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const nF = f2v.length

      const vertsM = Matrix.empty([nV, 3])
      vertsM.data.set(verts.flat())

      const f2vM = Matrix.empty([nF, 3], Uint32Array)
      f2vM.data.set(f2v.flat())

      const run = () => ddg.computeMoreV2(vertsM, f2vM)
      const { resultString } = timeit('args.run()', '', '', { run }, 8)
      console.log(resultString)
    })
  })

  describe('computeLaplacian', () => {
    it('bunny', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const more = ddg.computeMore(verts, f2v, topology)
      const run = () => ddg.computeLaplacian(nV, topology.e2v, more.hodge1)
      const { resultString } = timeit('args.run()', '', '', { run }, 4)
      console.log(resultString)
    })
  })

  describe('computeLaplacianV2', () => {
    it('bunny', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const nF = f2v.length

      const vertsM = Matrix.empty([nV, 3])
      vertsM.data.set(verts.flat())

      const f2vM = Matrix.empty([nF, 3], Uint32Array)
      f2vM.data.set(f2v.flat())

      const run = () => ddg.computeLaplacianV2(vertsM, f2vM)
      const { resultString } = timeit('args.run()', '', '', { run }, 8)
      console.log(resultString)
    })
  })

  describe('computeMeanCurvature', () => {
    it('bunny', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const more = ddg.computeMore(verts, f2v, topology)
      const L = ddg.computeLaplacian(nV, topology.e2v, more.hodge1)
      const run = () => ddg.computeMeanCurvature(verts, L)
      const { resultString } = timeit('args.run()', '', '', { run }, 4)
      console.log(resultString)
    })
  })

  describe('computeMeanCurvatureV2', () => {
    it('bunny', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const topology = ddg.computeTopology(f2v, nV)
      const more = ddg.computeMore(verts, f2v, topology)
      const L = ddg.computeLaplacian(nV, topology.e2v, more.hodge1)
      const vertsT = ddg.transposeVerts(verts)
      const run = () => ddg.computeMeanCurvatureV2(vertsT, L)
      const { resultString } = timeit('args.run()', '', '', { run }, 4)
      console.log(resultString)
    })
  })

  describe('computeMeanCurvatureV3', () => {
    it('bunny (MatrixCOO.matmul)', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const nF = f2v.length

      const vertsM = Matrix.empty([nV, 3])
      vertsM.data.set(verts.flat())

      const f2vM = Matrix.empty([nF, 3], Uint32Array)
      f2vM.data.set(f2v.flat())

      const L = ddg.computeLaplacianV2(vertsM, f2vM)
      const hn2 = Matrix.empty(vertsM.shape)

      const run = () => L.matmul(hn2, vertsM)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })

    it('bunny (MatrixCSR.matmul)', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const nF = f2v.length

      const vertsM = Matrix.empty([nV, 3])
      vertsM.data.set(verts.flat())

      const f2vM = Matrix.empty([nF, 3], Uint32Array)
      f2vM.data.set(f2v.flat())

      const L = MatrixCSR.fromCOO(ddg.computeLaplacianV2(vertsM, f2vM))
      const hn2 = Matrix.empty(vertsM.shape)

      const run = () => L.matmul(hn2, vertsM)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })

    it('bunny (MatrixCSR.matmul (sumDuplicate)', async () => {
      const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
      const { verts, f2v } = readOFF(data)
      const nV = verts.length
      const nF = f2v.length

      const vertsM = Matrix.empty([nV, 3])
      vertsM.data.set(verts.flat())

      const f2vM = Matrix.empty([nF, 3], Uint32Array)
      f2vM.data.set(f2v.flat())

      const L = MatrixCSR.fromCOO(ddg.computeLaplacianV2(vertsM, f2vM))
      L.sumDuplicates()

      const hn2 = Matrix.empty(vertsM.shape)

      const run = () => L.matmul(hn2, vertsM)
      const { resultString } = timeit('args.run()', '', '', { run })
      console.log(resultString)
    })
  })
})
