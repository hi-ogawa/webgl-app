//
// Just good enough to read some data used by libigl
// - https://libigl.github.io/file-formats/
// - https://github.com/libigl/libigl-tutorial-data
//

import _ from '../../web_modules/lodash.js'

const readOFF = (data) => {
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

  // TODO: for now, we still use `Array`
  return {
    verts: _.chunk(Array.from(verts), 3),
    f2v: _.chunk(Array.from(f2v), 3)
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

export { readOFF, readOBJ }