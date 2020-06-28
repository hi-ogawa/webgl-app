import fs from 'fs'
import * as misc2 from '../src/utils/misc2.js'
import * as reader from '../src/utils/reader.js'

const main = (n, outfile) => {
  n = Number(n)
  const ostr = fs.createWriteStream(outfile)
  const { verts, c3xc0 } = misc2.makeTetrahedralizedCube(n)
  reader.writeMESH(verts.data, c3xc0.data, ostr)
}

main(...process.argv.slice(2))
