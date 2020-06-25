/* eslint camelcase: 0 */

//
// Projective dynamics (Surface strain)
//

import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/coordinate-grid.js'
import '../utils/aframe/geometry.js'
import '../utils/aframe/simple-controls.js'
import * as glm from '../utils/glm.js'
import { Example01 } from '../utils/physics.js'

const THREE = AFRAME.THREE
const { $ } = UtilsMisc

AFRAME.registerComponent('physics', {
  dependencies: ['geometry'],

  init () {
    this.solver = new Example01()
    this.solver.init()

    const { x, f2v } = this.solver

    const { geometry } = this.el.components.geometry
    geometry.attributes.position = new THREE.BufferAttribute(x.data, 3)
    geometry.index = new THREE.BufferAttribute(f2v.data, 1)
    geometry.computeVertexNormals()
    this.geometry = geometry
  },

  tick () {
    // Interactive handle
    glm.vec3.copy(
      this.solver.handles[0],
      this.el.sceneEl.querySelector('#handle1').object3D.position.toArray())

    this.solver.update()
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
