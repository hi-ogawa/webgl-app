/* eslint camelcase: 0 */

//
// Projective dynamics (Surface strain)
//

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
import { Matrix } from '../utils/array.js' // eslint-disable-line
import { Example01 } from '../utils/physics.js'

const THREE = AFRAME.THREE
const { $ } = misc

AFRAME.registerComponent('physics', {
  play () {
    // Define geometry
    const n = 16
    const { position, index } = misc.makePlane(n, n, false, false, true, false)
    const { verts, f2v } = misc2.toMatrices(position, index)
    // [ Uniform triangles example ]
    // const { verts, f2v } = misc2.makeTriangle(n)

    this.geometry = this.el.components.geometry.geometry
    this.geometry.attributes = {}
    this.geometry.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    this.geometry.index = new THREE.BufferAttribute(f2v.data, 1)
    this.geometry.computeVertexNormals()

    this.surface = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        roughness: 0.8, opacity: 0.8, transparent: true, color: '#f84', side: THREE.DoubleSide
      }))
    this.el.setObject3D('surface', this.surface)

    // Define interaction handles
    this.handles = [
      { vertex: 0, target: [-0.5, 0, 0] },
      { vertex: n, target: [0.5, 0, 0] },
      { vertex: n / 2, target: [0, 0, 0] }
    ]

    // Initialize solver
    this.solver = new Example01()
    this.solver.init(verts, f2v, this.handles)
  },

  tick () {
    // Interactive handle
    glm.vec3.copy(this.handles[0].target, $('#root #handle1').object3D.position.toArray())
    glm.vec3.copy(this.handles[1].target, $('#root #handle2').object3D.position.toArray())
    glm.vec3.copy(this.handles[2].target, $('#root #handle3').object3D.position.toArray())

    // Solver update
    this.solver.update()

    // Geometry update
    this.geometry.computeVertexNormals()
    this.geometry.attributes.position.needsUpdate = true
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree()
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
