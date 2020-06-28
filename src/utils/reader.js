//
// Just good enough to read some data used by libigl
// - https://libigl.github.io/file-formats/
// - https://github.com/libigl/libigl-tutorial-data
//

import _ from '../../web_modules/lodash.js'
import { assertf } from './misc2.js'
import { Matrix } from './array.js'

const readOFF = (data, typedarray = false) => {
//
// OFF
// <nV> <nF> <nE>
// <x> <y> <z>
// ... nV times
// 3 <v0> <v1> <v2>
// ... nF times
//
  const lines = data.split('\n')
  if (lines.length < 2) {
    throw new Error('[readOFF]')
  }

  const line1 = lines[0].trim()
  if (line1 !== 'OFF') {
    throw new Error(`[readOFF] expected "OFF" but found "${line1}"`)
  }

  const line2 = lines[1].trim()
  const nVFE = line2.match(/^(\d+) (\d+) (\d+)$/)
  if (!nVFE) {
    throw new Error(`[readOFF] expected "<nV> <nF> <nE>" but found "${line2}"`)
  }
  const [nV, nF, nE] = nVFE.slice(1).map(n => Number(n))
  if (nE !== 0) {
    throw new Error('[readOFF] expected "nE === 0"')
  }
  if (lines.length < nV + nF + 2) {
    throw new Error('[readOFF]')
  }

  const verts = new Float32Array(nV * 3)
  const f2v = new Uint32Array(nF * 3)

  for (let i = 0; i < nV; i++) {
    const v = lines[i + 2].split(' ')
    for (let j = 0; j < 3; j++) {
      verts[3 * i + j] = Number(v[j])
    }
  }

  for (let i = 0; i < nF; i++) {
    const v = lines[i + 2 + nV].split(' ')
    for (let j = 0; j < 3; j++) {
      f2v[3 * i + j] = Number(v[j + 1])
    }
  }

  if (typedarray) {
    return { verts, f2v }
  }

  return {
    verts: _.chunk(Array.from(verts), 3),
    f2v: _.chunk(Array.from(f2v), 3)
  }
}

const writeOFF = (verts, f2v, ostr) => {
  const nV = verts.length / 3
  const nF = f2v.length / 3
  // [ Header ]
  // OFF
  // <nV> <nF> <nE>
  ostr.write(`OFF\n${nV} ${nF} 0\n`)

  // [ verts ]
  // <x> <y> <z>
  for (let i = 0; i < nV; i++) {
    for (let j = 0; j < 3; j++) {
      if (j > 0) {
        ostr.write(' ')
      }
      ostr.write(String(verts[3 * i + j]))
    }
    ostr.write('\n')
  }

  // [ f2v ]
  // 3 <v0> <v1> <v2>
  for (let i = 0; i < nF; i++) {
    ostr.write('3 ')
    for (let j = 0; j < 3; j++) {
      if (j > 0) {
        ostr.write(' ')
      }
      ostr.write(String(f2v[3 * i + j]))
    }
    ostr.write('\n')
  }
}

const readOBJ = (data) => {
//
// v <x> <y> <z>
// ...
// f <v0> <v1> <v2>
// ...
//
  const lines = data.split('\n').map(l => l.trim())
  const verts = []
  const f2v = []
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const vs = line.split(' ').slice(1).map(x => Number(x))
      verts.push(vs)
    }
    if (line.startsWith('f ')) {
      let fs = line.split(' ').slice(1)
      if (fs[0].includes('/')) {
        fs = fs.map(f => f.split('/')[0])
      }
      fs = fs.map(x => Number(x) - 1)
      f2v.push(fs)
    }
  }
  return { verts, f2v }
}

const writeOBJ = (verts, f2v, ostr) => {
  const nV = verts.length / 3
  const nF = f2v.length / 3
  for (let i = 0; i < nV; i++) {
    const x = verts[3 * i + 0]
    const y = verts[3 * i + 1]
    const z = verts[3 * i + 2]
    ostr.write(`v ${x} ${y} ${z}\n`)
  }
  for (let i = 0; i < nF; i++) {
    const v0 = f2v[3 * i + 0] + 1
    const v1 = f2v[3 * i + 1] + 1
    const v2 = f2v[3 * i + 2] + 1
    ostr.write(`f ${v0} ${v1} ${v2}\n`)
  }
}

const readMESH = (data) => {
//
// MeshVersionFormatted 1
// Dimension 3
// Vertices
// <nV>
// <x> <y> <z> 0
// ...
// Triangles
// <nF>
// ...
// Tetrahedra
// <nT>
// ...
//
  const lines = data.split('\n')
  assertf(() => lines.shift().trim() === 'MeshVersionFormatted 1')
  assertf(() => lines.shift().trim() === 'Dimension 3')

  // Vertices
  assertf(() => lines.shift().trim() === 'Vertices')
  const nV = Number(lines.shift())
  const verts = Matrix.empty([nV, 3])
  for (let i = 0; i < nV; i++) {
    const v = lines[i].split(' ')
    for (let j = 0; j < 3; j++) {
      verts.data[3 * i + j] = Number(v[j])
    }
  }
  lines.splice(0, nV)

  // Triangles
  assertf(() => lines.shift().trim() === 'Triangles')
  const nF = Number(lines.shift())
  const f2v = Matrix.empty([nF, 3], Uint32Array)
  for (let i = 0; i < nF; i++) {
    const v = lines[i].split(' ')
    for (let j = 0; j < 3; j++) {
      f2v.data[3 * i + j] = Number(v[j]) - 1 // Originally "1" based index
    }
  }
  lines.splice(0, nF)

  // Tetrahedra
  assertf(() => lines.shift().trim() === 'Tetrahedra')
  const nC3 = Number(lines.shift())
  const c3xc0 = Matrix.empty([nC3, 4], Uint32Array)
  for (let i = 0; i < nC3; i++) {
    const v = lines[i].split(' ')
    for (let j = 0; j < 4; j++) {
      c3xc0.data[4 * i + j] = Number(v[j]) - 1 // Originally "1" based index
    }
  }
  lines.splice(0, nC3)

  return { verts, f2v, c3xc0 }
}

const writeMESH = (verts, c3xc0, ostr) => {
  const nC0 = verts.length / 3
  const nC3 = c3xc0.length / 4

  ostr.write('MeshVersionFormatted 1\n')
  ostr.write('Dimension 3\n')

  // Vertices
  ostr.write('Vertices\n')
  ostr.write(`${nC0}\n`)
  for (let i = 0; i < nC0; i++) {
    const x = verts[3 * i + 0]
    const y = verts[3 * i + 1]
    const z = verts[3 * i + 2]
    ostr.write(`${x} ${y} ${z} ${0}\n`)
  }

  // Triangles
  ostr.write('Triangles\n')
  ostr.write('0\n')

  // Tetrahedra
  ostr.write('Tetrahedra\n')
  ostr.write(`${nC3}\n`)
  for (let i = 0; i < nC3; i++) {
    const v0 = c3xc0[4 * i + 0] + 1
    const v1 = c3xc0[4 * i + 1] + 1
    const v2 = c3xc0[4 * i + 2] + 1
    const v3 = c3xc0[4 * i + 3] + 1
    ostr.write(`${v0} ${v1} ${v2} ${v3} 0\n`)
  }
}

// Cf.
// - http://wias-berlin.de/software/tetgen/fformats.ele.html
// - http://wias-berlin.de/software/tetgen/fformats.node.html
// - https://github.com/mattoverby/admm-elastic/tree/master/samples/data
const readELENODE = (ele, node) => {
// [ .ele ]
// 2510  4  0
//     0     211   731   164   733
//     1     508   394   518   596
//     ...
  let c3xc0
  {
    const lines = ele.split('\n')
    assertf(() => lines.length > 0)

    const [_nC3, four, zero] = lines.shift().split(/\s+/)
    assertf(() => four === '4')
    assertf(() => zero === '0')

    const nC3 = Number(_nC3)
    c3xc0 = Matrix.empty([nC3, 4], Uint32Array)
    for (let i = 0; i < nC3; i++) {
      const v = lines[i].trim().split(/\s+/)
      for (let j = 0; j < 4; j++) {
        c3xc0.data[4 * i + j] = Number(v[j + 1])
      }
    }
  }

  // [ .node ]
  // 777  3  0  0
  //    0    -0.086654700000000001  0.15273100000000001  0.011778500000000001
  //    1    -0.063722399999999998  0.16536600000000001  -0.061750800000000002
  //    ...
  let verts
  {
    const lines = node.split('\n')
    assertf(() => lines.length > 0)

    const [_nV, three, zero0, zero1] = lines.shift().split(/\s+/)
    assertf(() => three === '3')
    assertf(() => zero0 === '0')
    assertf(() => zero1 === '0')

    const nV = Number(_nV)
    verts = Matrix.empty([nV, 3])
    for (let i = 0; i < nV; i++) {
      const v = lines[i].trim().split(/\s+/)
      for (let j = 0; j < 3; j++) {
        verts.data[3 * i + j] = Number(v[j + 1])
      }
    }
  }

  return { verts, c3xc0 }
}

export { readOFF, writeOFF, readOBJ, writeOBJ, readMESH, writeMESH, readELENODE }
