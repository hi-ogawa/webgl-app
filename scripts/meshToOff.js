//
// Example:
//   node scripts/meshToOff.js misc/data/bunny.off.tetwild.mesh misc/data/bunny.off.tetwild.mesh.off
//

import fs from 'fs'
import * as ddg from '../src/utils/ddg.js'
import * as reader from '../src/utils/reader.js'

// cf. ddg.test.js (computeD2)
const meshToOff = (infile, outfile) => {
  const data = fs.readFileSync(infile).toString()
  const { verts, c3xc0 } = reader.readMESH(data)
  const { c2xc0, d2 } = ddg.computeD2(c3xc0, verts.shape[0])
  const c2xc0B = ddg.computeBoundary(c2xc0, d2)
  reader.writeOFF(verts.data, c2xc0B.data, fs.createWriteStream(outfile))
}

meshToOff(...process.argv.slice(2))
