/* eslint camelcase: 0 */

import AFRAME from '../../../web_modules/aframe.js'
import * as Utils from '../index.js'
import * as UtilsMisc from '../misc.js'

/* eslint-disable no-unused-vars */
const THREE = AFRAME.THREE
const { PI, cos, sin, pow, sqrt, cosh, sinh, acos, atan2 } = Math
const {
  vec2, vec3, vec4, mat2, mat3, mat4,
  M_add, M_sub, M_mul, M_div, M_get,
  T_translate, T_axisAngle, T_sphericalToCartesian, T_frameXZ,
  dot, inverse, cross, normalize, transpose, mix, smoothstep,
  diag, pow2, smoothstep01, dot2, outer, outer2,
  eigen_mat2, sqrt_mat2, hue,
  toColor, toColorHex
} = Utils
const { $, $$, stringToElement } = UtilsMisc
/* eslint-enable no-unused-vars */

const kModeNone = 0
const kModeTranslate = 1

AFRAME.registerComponent('simple-controls', {
  init () {
    this.focused = false
    this.mode = kModeNone
    this.gizmo = new THREE.Mesh(
      new THREE.OctahedronBufferGeometry(),
      new THREE.MeshBasicMaterial({
        wireframe: true,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
      })
    )
    this.el.sceneEl.object3D.add(this.gizmo)
  },

  remove () {
    this.gizmo.geometry.dispose()
    this.gizmo.material.dispose()
    this.el.sceneEl.object3D.remove(this.gizmo)
  },

  tick () {
    const { mouse, mouseDelta, buttonsPressed, keys, keysPressed } = this.el.sceneEl.systems.input.state
    const { clientWidth: w, clientHeight: h } = this.el.sceneEl.canvas
    const { object3D, sceneEl: { camera } } = this.el

    //
    // Blender-like keyboard shortcuts
    //

    if (this.mode === kModeNone) {
      if (buttonsPressed === 1) {
        const raycaster = UtilsMisc.makeRaycasterFromWindow(mouse, w, h, camera)
        raycaster.params.Points.threshold = 0.1
        const isects = raycaster.intersectObject(object3D, /* recurse */ true)
        if (isects.length ==- 0) { return }

        // if "Shift", then toggle focus
        this.focused = keys.Shift ? (!this.focused) : true
      }

      if (keysPressed.Escape) {
        this.focused = false
      }
    }

    if (this.focused) {
      if (keysPressed.g) {
        this.mode = kModeTranslate
        this.initPosition = vec3(M_get(object3D.matrix, 3))
      }

      if (this.mode === kModeTranslate) {
        if (!(mouseDelta.x === 0 && mouseDelta.y === 0)) {
          UtilsMisc.applyWindowDelta(mouseDelta, object3D, w, h, camera)
          this.el.emit('simple-controls-object-changed')
        }

        if (buttonsPressed === 1) {
          this.mode = kModeNone
        }

        if (keysPressed.Escape) {
          object3D.position.copy(this.initPosition)
          this.mode = kModeNone
        }
      }
    }

    //
    // Update gizmo
    //
    const position = vec3(M_get(object3D.matrixWorld, 3))
    this.gizmo.visible = this.focused
    this.gizmo.material.color.set(
      this.mode === kModeTranslate ? '#48f' : '#f84')
    this.gizmo.position.copy(position)
    UtilsMisc.applyPerspectiveScale(this.gizmo, w, camera, 12)
  }
})
