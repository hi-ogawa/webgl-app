/* eslint camelcase: 0 */
/* global describe, it */

import fs from 'fs'
import util from 'util'
import { readOFF, readMESH } from './reader.js'
import { timeit } from './timeit.js'

const fsReadFile = util.promisify(fs.readFile)
const readFile = (f) => fsReadFile(f).then(buffer => buffer.toString())

describe('readOFF', () => {
  it('bunny', async () => {
    // 3485 6966
    const data = await readFile('thirdparty/libigl-tutorial-data/bunny.off')
    const run = () => readOFF(data)
    const { resultString } = timeit('args.run()', '', '', { run })
    console.log(resultString)
  })

  it('camelhead', async () => {
    // 11381 22704
    const data = await readFile('thirdparty/libigl-tutorial-data/camelhead.off')
    const run = () => readOFF(data)
    const { resultString } = timeit('args.run()', '', '', { run })
    console.log(resultString)
  })
})

describe('readMESH', () => {
  it('bunny', async () => {
    // c0: 5433
    // c2: 6966
    // c3: 34055
    const data = await readFile('thirdparty/libigl-tutorial-data/bunny.mesh')
    const run = () => readMESH(data)
    const { resultString } = timeit('args.run()', '', '', { run })
    console.log(resultString)
  })
})
