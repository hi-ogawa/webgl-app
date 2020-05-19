/* eslint camelcase: 0, no-eval: 0 */

//
// Camera3dHelper demo
//

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { AppBase, runApp } from '../utils/app.js'

/* eslint-disable no-unused-vars */
const { PI, cos, sin, pow } = Math
const {
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_sub, M_mul, M_div,
  T_translate, T_axisAngle, M_diag,
  pow2, dot, dot2, outer, outer2, cross, normalize,
  toColor
} = Utils
Utils.patchThreeMath()
/* eslint-enable no-unused-vars */

class App extends AppBase {
  constructor () {
    super(...arguments)
    this.camera = new THREE.PerspectiveCamera()
    this.cameraHelper = new UtilsMisc.Camera3dHelper(this.camera)
  }

  updateSize () {
    super.updateSize()
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  async init () {
    await super.init()
    this.gui.hide()

    // Camera
    _.assign(this.camera, { fov: 39, near: 1e-2, far: 1e2 })
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(M_mul(3, vec3(1, 1, 2)))
    this.cameraHelper.init()

    // Axes
    {
      const g = Utils.makeBufferGeometry(
        UtilsMisc.makeAxes([0, 1, 2], 10))
      const m = new THREE.LineBasicMaterial({
        linewidth: 2,
        vertexColors: true
      })
      const object = new THREE.LineSegments(g, m)
      object.frustumCulled = false
      this.scene.add(object)
    }

    // Grid
    {
      const g = Utils.makeBufferGeometry({
        position: UtilsMisc.makeGrid(1, 10)
      })
      const m = new THREE.LineBasicMaterial({
        linewidth: 1.5,
        color: 0x444444
      })
      const object = new THREE.LineSegments(g, m)
      object.frustumCulled = false
      this.scene.add(object)
    }

    // Geometry
    {
      const g = new THREE.IcosahedronBufferGeometry()
      const m = new THREE.MeshStandardMaterial({ color: 0x00ffcc, roughness: 0.5 })
      const object = new THREE.Mesh(g, m)
      this.scene.add(object)
    }

    // Lighting
    {
      const o1 = new THREE.DirectionalLight(toColor(vec3(0.8)))
      const o2 = new THREE.AmbientLight(toColor(vec3(0.2)))
      o1.name = 'sun'
      this.scene.add(o1)
      this.scene.add(o2)
    }
  }

  update () {
    super.update()

    // Input handling
    {
      const { mouseDelta, buttons, wheel, keys } = this.input

      if (wheel !== 0) {
        this.cameraHelper.zoom(-wheel / 800)
      }

      if (buttons === 1) {
        if (keys.Shift) {
          this.cameraHelper.move(
            this.windowToCameraDelta(M_mul(-1, mouseDelta)))
        }

        if (keys.Control) {
          this.cameraHelper.orbit(
            M_mul(2 * PI,
              M_mul(vec2(-1, 1),
                M_div(mouseDelta, vec2(this.width, this.height)))))
        }
      }
    }

    // Sun light from camera
    this.$('sun').position.copy(this.camera.position)
  }
}

const main = () => runApp(App, document.querySelector('#root'))

export { main }
