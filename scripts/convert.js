//
// Example:
//   node scripts/convert.js misc/data/bunny.off.tetwild.1e-2.mesh.off misc/data/bunny.off.tetwild.1e-2.mesh.obj
//

import fs from 'fs'
import * as reader from '../src/utils/reader.js'

const convert = (infile, outfile) => {
  const data = fs.readFileSync(infile).toString()
  const { verts, f2v } = reader.readOFF(data, true)
  reader.writeOBJ(verts, f2v, fs.createWriteStream(outfile))
}

convert(...process.argv.slice(2))
