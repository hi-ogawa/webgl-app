/* eslint camelcase: 0 */

import AFRAME from '../../../web_modules/aframe.js'
import * as Utils from '../index.js'
import * as UtilsMisc from '../misc.js'

/* eslint-disable no-unused-vars */
const THREE = AFRAME.THREE
const { PI, cos, sin, pow, sqrt, cosh, sinh } = Math
const {
  vec2, vec3, vec4, mat2, mat3, mat4,
  M_add, M_sub, M_mul, M_div, M_get,
  T_translate, T_axisAngle,
  dot, inverse, cross, normalize, transpose,
  diag, pow2, smoothstep01, dot2, outer, outer2,
  eigen_mat2, sqrt_mat2,
  toColor
} = Utils
/* eslint-enable no-unused-vars */

AFRAME.registerComponent('orbit-controls', {
  dependencies: ['input'],

  init () {
    this.helper = new UtilsMisc.Camera3dHelper(this.el.object3D)
    this.helper.init()

    this.objectLookat = new THREE.Mesh(
      new THREE.OctahedronBufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: '#8dd',
        wireframe: true,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
      })
    )
    this.el.sceneEl.object3D.add(this.objectLookat)
  },

  tick () {
    const { mouseDelta, buttons, keys, wheel } = this.el.sceneEl.systems.input.state
    const { clientWidth: w, clientHeight: h } = this.el.sceneEl.canvas
    const { camera } = this.el.sceneEl

    // Handle input
    if (wheel !== 0) {
      this.helper.zoom(-wheel / 800)
    }

    if (buttons === 1) {
      if (keys.Shift) {
        const windowToCamera = mat3(UtilsMisc.makeWindowToCamera(w, h, camera))
        const delta = M_mul(windowToCamera, M_mul(-1, vec3(mouseDelta, 0)))
        this.helper.move(vec2(delta))
      }

      if (keys.Control) {
        const delta =
          M_mul(2 * PI,
            M_mul(vec2(-1, 1),
              M_div(mouseDelta, vec2(w, h))))
        this.helper.orbit(delta)
      }
    }

    // Update "lookat" marker
    const z = M_sub(this.el.object3D.position, this.helper.lookat).length()
    const p = M_mul(camera.projectionMatrix, vec4(1, 0, -z, 1))
    const x = (p.x / p.w) * (w / 2)
    const size = 24 // size in pixel
    this.objectLookat.scale.copy(vec3(0.5 * size / x))
    this.objectLookat.position.copy(this.helper.lookat)
  }
})
