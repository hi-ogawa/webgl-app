- Generate monkey.mesh (monkey.obj is from Blender with its geometry simplified by hand and modifiers)

```
node scripts/literate.js misc/data/README.md obj-to-mesh 0.1 misc/data/monkey.obj misc/data/monkey.mesh
```

```js
// obj-to-mesh
import fs from 'fs'
import * as ddg from '../../src/utils/ddg.js'
import * as reader from '../../src/utils/reader.js'
import { Matrix } from '../../src/utils/array.js'

const main = (depth, infile, outfile) => {
  depth = Number(depth)

  // Load data
  const data = fs.readFileSync(infile).toString()
  const { verts: x, f2v: y } = reader.readOBJ(data)
  const verts = Matrix.empty([x.length, 3])
  const c2xc0 = Matrix.empty([y.length, 3], Uint32Array)
  verts.data.set(x.flat())
  c2xc0.data.set(y.flat())

  // Extrude to tetrahedra
  const [new_verts, c3xc0] = ddg.extrudeTrianglesToTetrahedra(verts, c2xc0, depth)

  // Write to file
  const ostr = fs.createWriteStream(outfile)
  reader.writeMESH(new_verts.data, c3xc0.data, ostr)
}

main(...process.argv.slice(2))
```

- Generate icosahedron extruded to tetrahedra (icosphere.mesh)

```
node scripts/literate.js misc/data/README.md icosphere-mesh 0.4 misc/data/icosphere.mesh
```

```js
// icosphere-mesh
import fs from 'fs'
import '../../src/mocha_jsdom.js' // unfortunate dependency for misc
import * as misc from '../../src/utils/misc.js'
import * as ddg from '../../src/utils/ddg.js'
import * as reader from '../../src/utils/reader.js'
import * as glm from '../../src/utils/glm.js'
import { Matrix } from '../../src/utils/array.js'

const main = (depth, outfile) => {
  depth = Number(depth)

  // Icosahedron
  const { position, index } = misc.makeHedron20()
  const verts = Matrix.empty([position.length, 3])
  const c2xc0 = Matrix.empty([index.length, 3], Uint32Array)
  verts.data.set(position.flat())
  c2xc0.data.set(index.flat())

  // Extrude to tetrahedra
  const [new_verts, c3xc0] = ddg.extrudeTrianglesToTetrahedra(verts, c2xc0, depth)

  // Normalize position
  const { normalizeeq, muleqs } = glm.vec3
  for (let i = 0; i < new_verts.shape[0]; i++) {
    const l = (i < 12 || (2 * 12 <= i && i < 2 * 12 + 30)) ? 1 : (1 - depth)
    muleqs(normalizeeq(new_verts.row(i)), l)
  }

  const ostr = fs.createWriteStream(outfile)
  reader.writeMESH(new_verts.data, c3xc0.data, ostr)
}

main(...process.argv.slice(2))
```

- Generate tetrahedralized cube (cube.mesh)

```
node scripts/literate.js misc/data/README.md cube-mesh 1 misc/data/cube.mesh
```

```js
// cube-mesh
import fs from 'fs'
import * as misc2 from '../../src/utils/misc2.js'
import * as reader from '../../src/utils/reader.js'

const main = (n, outfile) => {
  n = Number(n)
  const ostr = fs.createWriteStream(outfile)
  const { verts, c3xc0 } = misc2.makeTetrahedralizedCubeSymmetric(n)
  reader.writeMESH(verts.data, c3xc0.data, ostr)
}

main(...process.argv.slice(2))
```

- uv-blender.png is from Blender's "Color Grid"

- Generate .mesh file by [TetWild](https://github.com/Yixin-Hu/TetWild).

```
docker pull yixinhu/tetwild
docker run --rm -v "$(pwd)":/data yixinhu/tetwild --help
docker run --rm -v "$(pwd)":/data yixinhu/tetwild thirdparty/libigl-tutorial-data/bunny.off misc/data/bunny.off.tetwild.mesh
docker run --rm -v "$(pwd)":/data yixinhu/tetwild -e 1e-2 thirdparty/libigl-tutorial-data/bunny.off misc/data/bunny.off.tetwild.1e-2.mesh
```

- Generate boundary triangles (.off) from tetrahedra (.mesh)

```
node scripts/literate.js misc/data/README.md mesh-to-off misc/data/bunny.off.tetwild.mesh misc/data/bunny.off.tetwild.mesh.off
node scripts/literate.js misc/data/README.md mesh-to-off misc/data/bunny.off.tetwild.1e-2.mesh misc/data/bunny.off.tetwild.1e-2.mesh.off
```

```js
// mesh-to-off
import fs from 'fs'
import * as ddg from '../../src/utils/ddg.js'
import * as reader from '../../src/utils/reader.js'

const main = (infile, outfile) => {
  const data = fs.readFileSync(infile).toString()
  const { verts, c3xc0 } = reader.readMESH(data)
  const { c2xc0, d2 } = ddg.computeD2(c3xc0, verts.shape[0])
  const c2xc0B = ddg.computeBoundary(c2xc0, d2)
  reader.writeOFF(verts.data, c2xc0B.data, fs.createWriteStream(outfile))
}

main(...process.argv.slice(2))
```

- Convert from .off to .obj

```
node scripts/literate.js misc/data/README.md off-to-obj misc/data/bunny.off.tetwild.1e-2.mesh.off misc/data/bunny.off.tetwild.1e-2.mesh.obj
```

```js
// off-to-obj
import fs from 'fs'
import * as reader from '../../src/utils/reader.js'

const convert = (infile, outfile) => {
  const data = fs.readFileSync(infile).toString()
  const { verts, f2v } = reader.readOFF(data, true)
  reader.writeOBJ(verts, f2v, fs.createWriteStream(outfile))
}

convert(...process.argv.slice(2))
```
