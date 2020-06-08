//
// Just good enough to read some data used by libigl
// - https://libigl.github.io/file-formats/
// - https://github.com/libigl/libigl-tutorial-data
//

const readOFF = (data) => {
//
// OFF
// <nV> <nF> <nE>
// <x> <y> <z>
// ... nV times
// 3 <v0> <v1> <v2>
// ... nF times
//
  const [line1, line2, ...lines] = data.split('\n').map(l => l.trim())
  if (line1 !== 'OFF') {
    throw new Error(`[readOFF] expected "OFF" but found "${line1}"`)
  }

  const nVFE = line2.match(/^(\d+) (\d+) (\d+)$/)
  if (!nVFE) {
    throw new Error(`[readOFF] expected "<nV> <nF> <nE>" but found "${line2}"`)
  }
  const [nV, nF, nE] = nVFE.slice(1).map(n => Number(n))
  if (nE !== 0) {
    throw new Error('[readOFF] expected "nE === 0"')
  }

  const verts = lines.slice(0, nV).map(l =>
    l.trim().split(' ').map(x => Number(x)))

  const f2v = lines.slice(nV, nV + nF).map(l =>
    l.trim().split(' ').slice(1).map(x => Number(x)))

  return { verts, f2v }
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
