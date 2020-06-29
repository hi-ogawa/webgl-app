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
