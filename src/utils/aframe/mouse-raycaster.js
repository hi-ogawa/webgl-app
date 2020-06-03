/* eslint camelcase: 0 */

import _ from '../../../web_modules/lodash.js'
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

AFRAME.registerComponent('mouse-raycaster', {
  dependencies: ['input'],

  schema: {
    drawPoint: { default: true },
    enable: { default: true }
  },

  init () {
    this.intersections = []

    const point = UtilsMisc.makeDiskPoints([[0, 0, 0]], [[1, 1, 0]])

    // It's silly but need to convert from THREE to AFRAME.THREE
    this.object = new AFRAME.THREE.Points(point.geometry, point.material)
    _.assign(this.object, {
      visible: false,
      frustumCulled: false
    })

    this.el.sceneEl.object3D.add(this.object)
  },

  remove () {
    this.el.sceneEl.object3D.remove(this.object)
  },

  tick () {
    if (!this.data.enable) { return }

    const { mouse } = this.el.sceneEl.systems.input.state
    const { clientWidth: w, clientHeight: h } = this.el.sceneEl.canvas
    const { camera } = this.el.sceneEl
    const { mesh } = this.el.object3DMap

    const windowToRay = UtilsMisc.makeWindowToRay(w, h, camera)
    const ray_o = vec3(M_get(camera.matrixWorld, 3))
    const ray_d = normalize(vec3(M_mul(windowToRay, vec4(mouse, 0, 1))))
    const raycaster = new THREE.Raycaster(ray_o, ray_d)

    // Reset state
    this.intersections = []
    this.object.visible = false
    if (!mesh) { return }

    // Intersect
    this.intersections = raycaster.intersectObject(mesh)
    if (this.intersections.length === 0) { return }

    const { point } = this.intersections[0]
    this.object.position.copy(point)

    if (this.data.drawPoint) {
      this.object.visible = true
    }
  }
})
