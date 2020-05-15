/* global fetch */
/* eslint camelcase: 0 */

//
// Curvature and osculating circle
//

import * as THREE from '../../web_modules/three/build/three.module.js'
import * as Utils from '../utils/index.js'
import { AppBase, runApp } from '../utils/app.js'
import { Camera2dHelper } from '../utils/misc.js'

const { PI, cos, sin } = Math
const {
  vec2, vec3, mat4,
  M_add, M_mul,
  T_axisAngle,
  pow2
} = Utils

class App extends AppBase {
  constructor () {
    super(...arguments)
    this.camera = new THREE.Camera()

    // 2D control
    this.cameraHelper = new Camera2dHelper(this.camera)
    this.cameraHelper.fov_height = 16
    this.cameraHelper.updateMatrix()

    // Custom
    this.p = vec2(1, 0)
    this.f = (x) => 0.5 * x * cos(x)
    this.uniforms = {
      U_window_to_world: { value: mat4(1) },
      U_point_size: { value: 8 }
    }
  }

  updateSize () {
    super.updateSize()
    this.cameraHelper.width = this.width
    this.cameraHelper.height = this.height
    this.cameraHelper.aspect = this.aspect
    this.cameraHelper.updateMatrix()
  }

  async init () {
    await super.init()

    // Gui
    const gui_params = {
      play: true,
      f: '0.5 * x * cos(x)'
    }
    this.gui.add(gui_params, 'play').onFinishChange(b => b ? this.start() : this.stop())
    this.gui.add(gui_params, 'f').onFinishChange(s => {
      this.f = eval(`(x) => ${s}`)
      const xs = Utils.linspace(-20, 20, 256)
      const position = xs.map(x => [x, this.f(x), 0])
      this.$('graph').geometry.dispose()
      this.$('graph').geometry = Utils.makeBufferGeometry({ position })
    })

    // Fetch glsl
    const index_glsl = await (await fetch('./index.glsl')).text()

    // Axes/Grid
    {
      {
        const grid = new THREE.GridHelper(32, 32)
        grid.applyMatrix4(mat4(T_axisAngle(vec3(1, 0, 0), 0.5 * PI)))
        grid.position.copy(vec3(0, 0, -3))
        this.scene.add(grid)
      }

      {
        const geometry = Utils.makeBufferGeometry({
          position: [[-1, 0, 0], [+1, 0, 0], [0, -1, 0], [0, +1, 0]],
          color: [[1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 0]]
        })
        const axes = new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false }))
        axes.scale.copy(vec3(1e3, 1e3, 1))
        axes.position.copy(vec3(0, 0, -2))
        this.scene.add(axes)
      }
    }

    // Points (tangent point and circle center)
    {
      const geometry = Utils.makeBufferGeometry({ position: [[0, 0, 0], [0, 0, 0]] })
      const material = Utils.makeShaderMaterial(index_glsl, { Main01: 1 })
      material.uniforms = this.uniforms
      material.transparent = true

      const object = new THREE.Points(geometry, material)
      object.name = 'points'
      this.scene.add(object)
    }

    // Graph y = f(x)
    {
      const xs = Utils.linspace(-20, 20, 256)
      const position = xs.map(x => [x, this.f(x), 0])
      const geometry = Utils.makeBufferGeometry({ position })
      const object = new THREE.Line(geometry, new THREE.LineBasicMaterial())
      object.name = 'graph'
      this.scene.add(object)
    }

    // circle
    {
      const xs = Utils.linspace(0, 2 * PI, 128)
      const position = xs.map(x => [cos(x), sin(x), 0])
      const geometry = Utils.makeBufferGeometry({ position })
      const object = new THREE.Line(geometry, new THREE.LineBasicMaterial())
      object.name = 'circle'
      this.scene.add(object)
    }

    // line x = x0
    {
      const position = [[0, -1e2, 0], [0, 1e2, 0]]
      const geometry = Utils.makeBufferGeometry({ position })
      const object = new THREE.Line(geometry, new THREE.LineBasicMaterial())
      object.name = 'x = x0'
      this.scene.add(object)
    }
  }

  update () {
    super.update()

    {
      // Input handling
      const { mouse, mouseDelta, wheel, buttons, shiftKey } = this.input
      if (wheel !== 0) {
        this.cameraHelper.zoom(mouse, wheel / 1024)
      }

      if (buttons === 1) {
        if (shiftKey) {
          this.cameraHelper.move(M_mul(-1, mouseDelta))
        } else {
          this.p = this.cameraHelper.windowToWorld(mouse)
        }
      }
    }

    {
      // Compute osculating circle
      // cf. https://hi-ogawa.github.io/markdown-tex/?id=e40372524f96337f1f2066ad332b4d2b&filename=curvature-00-1d-on-2d
      const x = this.p.x
      const y = this.f(x)
      const dx = 1e-3
      const dy = (this.f(x + dx) - this.f(x - dx)) / (2 * dx)
      const ddy = (this.f(x + dx) + this.f(x - dx) - 2 * y) / pow2(dx)
      const ddg = M_mul(ddy / pow2(1 + pow2(dy)), vec2(-dy, 1)) // g : arc-length parametrized curve (x, f(x))
      const k = ddg.length()
      const u = vec2(ddg).normalize()
      const radius = 1 / k
      const center = M_add(M_mul(radius, u), vec2(x, y))

      this.$('x = x0').position.copy(vec3(x, 0, 0))
      this.$('points').geometry.attributes.position.setXYZ(0, x, y, 0)
      this.$('points').geometry.attributes.position.setXYZ(1, ...center.toArray(), 0)
      this.$('points').geometry.attributes.position.needsUpdate = true
      this.$('circle').position.copy(vec3(center, 0))
      this.$('circle').scale.copy(vec3(radius))
    }
  }
}

const main = () => runApp(App, document.querySelector('#root'))

export { main }
