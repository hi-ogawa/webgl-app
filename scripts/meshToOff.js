//
// Example:
//   node scripts/meshToOff.js misc/data/bunny.off.tetwild.mesh misc/data/bunny.off.tetwild.mesh.off
//

import fs from 'fs'
import * as ddg from '../src/utils/ddg.js'
import * as reader from '../src/utils/reader.js'

// cf. ddg.test.js (computeTopologyV3)
const meshToOff = (infile, outfile) => {
  const data = fs.readFileSync(infile).toString()
  const { verts, c3xc0 } = reader.readMESH(data)
  const { f2v, d2 } = ddg.computeTopologyV3(c3xc0, verts.shape[0])
  const f2vB = ddg.computeBoundary(f2v, d2)
  reader.writeOFF(verts.data, f2vB.data, fs.createWriteStream(outfile))
}

meshToOff(...process.argv.slice(2))
