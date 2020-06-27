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
node scripts/meshToOff.js misc/data/bunny.off.tetwild.mesh misc/data/bunny.off.tetwild.mesh.off
node scripts/meshToOff.js misc/data/bunny.off.tetwild.1e-2.mesh misc/data/bunny.off.tetwild.1e-2.mesh.off
```
