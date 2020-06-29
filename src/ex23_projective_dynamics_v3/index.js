/* eslint camelcase: 0 */

//
// Projective dynamics (Volume strain)
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
import * as physics from '../utils/physics.js'
import * as ddg from '../utils/ddg.js'

const THREE = AFRAME.THREE
const { $, stringToElement } = misc

AFRAME.registerComponent('physics-twist', {
  tick () {
    const { keysPressed } = this.el.sceneEl.systems.input.state
    const { n, handles } = this.el.components.physics
    const { add, sub, matmul } = glm.vec3
    const { axisAngle, transpose } = glm.mat3
    const { PI } = Math

    const o = [0.5, 0.5, 0]
    const rot1 = axisAngle([0, 0, 1], 2 * PI * 0.01)
    const rot2 = transpose(rot1)

    if (keysPressed.ArrowUp) {
      for (const i in handles) {
        const { vertex } = handles[i]
        if (vertex >= (n + 1) * (n + 1) * n) {
          const { position } = $('#root #handles').children[i].object3D
          const p = position.toArray()
          const q = add(matmul(rot1, sub(p, o)), o)
          position.fromArray(q)
        }
      }
    }

    if (keysPressed.ArrowDown) {
      for (const i in handles) {
        const { vertex } = handles[i]
        if (vertex >= (n + 1) * (n + 1) * n) {
          const { position } = $('#root #handles').children[i].object3D
          const p = position.toArray()
          const q = add(matmul(rot2, sub(p, o)), o)
          position.fromArray(q)
        }
      }
    }
  }
})

AFRAME.registerComponent('physics', {
  schema: {
    // 0: two side fixed and twist
    // 1: one side fixed
    type: { default: 1, oneOf: [0, 1, 2] }
  },

  init () {
    const n = 4
    const { verts, c3xc0 } = misc2.makeTetrahedralizedCube(n, false)
    this.n = n

    // boundary surface
    const { c2xc0, d2 } = ddg.computeD2(c3xc0, verts.shape[0])
    const c2xc0B = ddg.computeBoundary(c2xc0, d2)

    // geometry
    this.geometry = new THREE.BufferGeometry()
    this.geometry.index = new THREE.BufferAttribute(c2xc0B.data, 1)
    this.geometry.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    this.geometry.computeVertexNormals()
    $('#root #wireframe').setObject3D('mesh', new THREE.Mesh(this.geometry))
    $('#root #surface').setObject3D('mesh', new THREE.Mesh(this.geometry))

    // interaction handles
    this.handles = []
    for (let k = 0; k <= n; k++) {
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
          if (i > 0 && j > 0 && i < n && j < n) { continue }
          if (k > 0 && k < n) { continue }
          if (this.data.type !== 0 && k === n) { continue }

          const v = (n + 1) * (n + 1) * k + (n + 1) * j + i
          const p = verts.row(v)
          this.handles.push({ vertex: v, target: Array.from(p) })
        }
      }
    }

    for (const i in this.handles) {
      const { target } = this.handles[i]
      $('#root #handles').appendChild(stringToElement(`
        <a-entity position="${target.join(' ')}" simple-controls>
          <a-entity mixin="point"></a-entity>
        </a-entity>
      `))
    }

    // solver
    this.solver = new physics.Example02()
    this.solver.init(verts, c3xc0, this.handles)
  },

  tick () {
    // Update interaction handle constraint
    for (const i in this.handles) {
      const { target } = this.handles[i]
      const el = $('#root #handles').children[i]
      glm.vec3.copy(target, el.object3D.position.toArray())

      // TODO: find a better way to choose handle
      el.components['simple-controls'].focused = true
    }

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
