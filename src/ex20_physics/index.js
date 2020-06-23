/* eslint camelcase: 0 */

//
// Discrete trivial connection with prescribed singularity
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
import { Example00 } from '../utils/physics.js'

const THREE = AFRAME.THREE
const { $ } = UtilsMisc

AFRAME.registerComponent('physics', {
  init () {
    this.solver = new Example00()
    this.solver.init()

    const { x } = this.solver
    this.points = new THREE.Points()
    this.points.material = new THREE.PointsMaterial({
      sizeAttenuation: false,
      alphaMap: UtilsMisc.makeDiskAlphaMap(2, 1), // radius, aa
      transparent: true,
      depthTest: false
    })
    this.points.material.size = this.points.material.alphaMap.image.width
    this.points.geometry = new THREE.BufferGeometry()
    this.points.geometry.attributes.position = new THREE.BufferAttribute(x.data, 3)
    this.el.setObject3D('points', this.points)

    this.lines = new THREE.Line()
    this.lines.material = new THREE.LineBasicMaterial({ linewidth: 1.5 })
    this.lines.geometry = new THREE.BufferGeometry()
    this.lines.geometry.attributes.position = new THREE.BufferAttribute(x.data, 3)
    this.el.setObject3D('lines', this.lines)
  },

  tick () {
    // Interactive handle
    glm.vec3.copy(
      this.solver.pinPositions[0],
      this.el.sceneEl.querySelector('#handle1').object3D.position.toArray())

    glm.vec3.copy(
      this.solver.pinPositions[1],
      this.el.sceneEl.querySelector('#handle2').object3D.position.toArray())

    this.solver.update()
    this.points.geometry.attributes.position.needsUpdate = true
    this.lines.geometry.attributes.position.needsUpdate = true
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree()
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
