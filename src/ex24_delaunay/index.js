/* eslint camelcase: 0 */

//
// Delaunay tesselation 3D
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as misc from '../utils/misc.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/coordinate-grid.js'
import '../utils/aframe/geometry.js'
import '../utils/aframe/simple-controls.js'
import * as glm from '../utils/glm.js'
import * as misc2 from '../utils/misc2.js'
import * as ddg from '../utils/ddg.js'
import { Matrix } from '../utils/array.js'

const THREE = AFRAME.THREE
const { $, stringToElement } = misc

AFRAME.registerComponent('delaunay', {
  init () {
    const nC0 = 5
    const verts = Matrix.empty([nC0, 3])
    verts.data.set([
      1, -1, 0,
      -1, -1, 0,
      0, 1, 0,
      0, 0, 1,
      0, 0, -1
    ])

    for (let i = 0; i < nC0; i++) {
      const p = verts.row(i)
      $('#root #handles').appendChild(stringToElement(`
        <a-entity position="${p.join(' ')}" simple-controls>
          <a-entity mixin="point"></a-entity>
        </a-entity>
      `))
    }

    // edges
    const geometry1 = new THREE.BufferGeometry()
    geometry1.index = new THREE.BufferAttribute(new Uint32Array(2 ** 10), 1) // over-estimate
    geometry1.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    $('#root #wireframe').setObject3D('mesh', new THREE.Mesh(geometry1))

    // interior 2 cells
    const geometry2 = new THREE.BufferGeometry()
    geometry2.index = new THREE.BufferAttribute(new Uint32Array(2 ** 10), 1)
    geometry2.attributes.position = geometry1.attributes.position // reuse position buffer
    $('#root #interior').setObject3D('mesh', new THREE.Mesh(geometry2))

    // Boundary 2 cells
    // (this occludes interior, so it's disabled for now. probably needs to do draw call for each face so that we can order and blend them properly)
    const geometry3 = new THREE.BufferGeometry()
    geometry3.index = new THREE.BufferAttribute(new Uint32Array(2 ** 10), 1)
    geometry3.attributes.position = geometry1.attributes.position
    $('#root #boundary').setObject3D('mesh', new THREE.Mesh(geometry3))

    // Circum spheres (update object position (center) and scale (radius))
    for (let i = 0; i < 8; i++) { // over-estimate (should be always 2/3/4 spheres)
      $('#root #spheres').appendChild(stringToElement(`
        <a-entity mixin="sphere"></a-entity>
      `))
    }

    _.assign(this, { verts, geometry1, geometry2, geometry3 })
  },

  tick () {
    const { verts, geometry1, geometry2, geometry3 } = this

    // Copy handles (c0)
    for (let i = 0; i < verts.shape[0]; i++) {
      const el = $('#root #handles').children[i]
      verts.row(i).set(el.object3D.position.toArray())
    }

    // Delaunay (c0 -> c3)
    const c3xc0 = misc2.delaunayBruteforce(verts)

    // 2 cells (c3 -> c2)
    const { c2xc0, d2 } = ddg.computeD2(c3xc0, verts.shape[0])
    geometry1.index.array.set(c2xc0.data)
    geometry1.index.count = c2xc0.data.length
    geometry1.drawRange.count = c2xc0.data.length

    // Interior 2 cells (c2I)
    const { c2B } = ddg.computeBoundaryC3(d2)
    const c2I = c2B.clone().negate()
    const c2Ixc0 = Matrix.sliceByBools(c2xc0, c2I.data)
    geometry2.index.array.set(c2Ixc0.data)
    geometry2.index.count = c2Ixc0.data.length
    geometry2.drawRange.count = c2Ixc0.data.length

    // Boundary 2 cells (c2B)
    const c2Bxc0 = Matrix.sliceByBools(c2xc0, c2B.data)
    geometry3.index.array.set(c2Bxc0.data)
    geometry3.index.count = c2Bxc0.data.length
    geometry3.drawRange.count = c2Bxc0.data.length

    // Curcumsphere (c3 -> spheres)
    Array.from($('#root #spheres').children).forEach(el => { el.object3D.visible = false }) // reset to invisible
    for (let i = 0; i < c3xc0.shape[0]; i++) {
      const vs = c3xc0.row(i)
      const [p0, p1, p2, p3] = Array.from(vs).map(v => verts.row(v))
      const c = misc2.circumsphere(p0, p1, p2, p3)
      const r = glm.vec3.length(glm.vec3.sub(p0, c))
      const el = $('#root #spheres').children[i]
      el.object3D.visible = true
      el.object3D.position.fromArray(c)
      el.object3D.scale.fromArray([r, r, r])
    }

    // Geometry update
    geometry1.computeVertexNormals()
    geometry1.attributes.position.needsUpdate = true
    geometry1.index.needsUpdate = true
    geometry2.computeVertexNormals()
    geometry2.index.needsUpdate = true
    geometry3.computeVertexNormals()
    geometry3.index.needsUpdate = true
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree()
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
