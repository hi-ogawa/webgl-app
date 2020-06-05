/* eslint-disable */

//
// 2d camera control
// (manage transform in js and integrate more Three's infrastructure)
//

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import { GUI } from '../../web_modules/three/examples/jsm/libs/dat.gui.module.js'
import * as Utils from '../utils/index.js'
import { patchAframeThree } from '../utils/aframe/misc.js'

const { PI } = Math
const { Vector2, Vector3, Vector4, Matrix3, Matrix4 } = THREE
const {
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_mul, M_diag, M_inverse,
  T_translate, T_rotate
} = Utils

class App {
  constructor (renderer) {
    this.renderer = renderer
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.width = this.height = 0
    this.uniforms = {
      U_time: { value: 0 },
      U_resolution: { value: vec2(0, 0) },
      U_c: { value: vec2(0, 0) },
      U_window_to_world: { value: mat4(1) },
      U_point_size: { value: 8 }
    }
    this.time = null
    this.use_mouse = false
    this.gui = new GUI()

    this.camera_xy = vec2(0, 0)
    this.zoom = 0 // = log_2(scale) so it's additive
    this.fov_height = 2.5
    this.window_to_world = mat4(1.0)

    this._updateSize()
  }

  _updateSize () {
    const canvas = this.renderer.domElement
    const { clientWidth: w_css, clientHeight: h_css } = canvas

    this.width = w_css
    this.height = h_css

    this.renderer.setSize(w_css, h_css, /* updateStyle */ false)
    const { width: w_res, height: h_res } = canvas
    this.uniforms.U_resolution.value = vec2(w_res, h_res)

    this._updateMatrix()
  }

  _updateMatrix () {
    this.camera.position.copy(vec3(this.camera_xy, 1.0))
    this.camera.updateMatrix()

    this.camera.projectionMatrix = Utils.T_orthographic(
      Utils.yfovFromHeight(Math.pow(2, this.zoom) * this.fov_height),
      this.width / this.height, 1e-2, 1e2)

    this.window_to_camera = [
      M_diag(vec4(1, 1, 0, 1)), // to z = 0
      M_inverse(this.camera.projectionMatrix), // inverse projection
      T_translate(vec3(-1, -1, 0)), // window to ndc (translate)
      M_diag(vec4(2 / this.width, 2 / this.height, 0, 1)) // window to ndc (scale)
    ].reduce(M_mul)

    this.window_to_world = [
      M_diag(vec4(1, 1, 0, 1)), // to z = 0
      this.camera.matrix,
      T_translate(vec3(0, 0, -1)), // to z = -1
      this.window_to_camera
    ].reduce(M_mul)

    this.uniforms.U_window_to_world.value = this.window_to_world
  }

  _updateTime () {
    const now = performance.now()
    this.time = this.time || now
    this.uniforms.U_time.value += (this.time - now) / 1000
    this.time = now
  }

  _updateUniforms () {
    if (!this.use_mouse) {
      const t = 2 * PI * this.uniforms.U_time.value / 16
      const c = vec2(M_mul(T_rotate(t), vec3(1.05, 0, 1)))
      this.uniforms.U_c.value = c
    }
  }

  _checkShaderError () {
    const bad_programs = this.renderer.info.programs.filter(p => p.diagnostics)
    if (bad_programs.length > 0) {
      this.stop()
      var message = ''
      for (const p of bad_programs) {
        const d = p.diagnostics
        message += `\
${p.name}:
  program:  ${d.programLog}
  vertex:   ${d.vertexShader.log}
  fragment: ${d.fragmentShader.log}
`
      }
      window.alert(`[ShaderError]\n${message}`)
    }
  }

  _yflip (y) { return this.height - y - 1 }

  mousemove (event) {
    if (event.buttons === 1) {
      const { clientX: x, clientY: y, movementX: dx, movementY: dy } = event
      if (event.shiftKey) {
        this.camera_xy.add(
          vec2(M_mul(mat3(this.window_to_camera), vec3(-dx, dy, 0))))
      } else {
        const mouse = M_mul(
          this.window_to_world, vec4(x, this._yflip(y), 0, 1))
        this.uniforms.U_c.value = vec2(mouse)
      }
    }
  }

  wheel (event) {
    const { clientX: x, clientY: y, deltaY: dy } = event
    const dzoom = dy / 1024

    // Preserve "mouse"
    // <=> camera' + to_camera' * mouse = camera + to_camera * mouse
    // <=> camera' = camera + (to_camera - to_camera') * mouse
    const mouse = vec4(x, this._yflip(y), 0, 1)
    const prev = this.window_to_camera.clone()
    this.zoom += dzoom
    this._updateMatrix()
    this.camera_xy.add(
      vec2(M_mul(M_add(prev, M_mul(-1, this.window_to_camera)), mouse)))
  }

  async init () {
    // Gui
    const gui_params = {
      play: true,
      use_mouse: this.use_mouse
    }
    this.gui.add(gui_params, 'play').onFinishChange(b => b ? this.start() : this.stop())
    this.gui.add(gui_params, 'use_mouse').onFinishChange(b => this.use_mouse = b)

    // Fetch glsl
    const index_glsl = await (await fetch('./index.glsl')).text()

    // Screen quad with custom shader as background
    {
      const geometry = Utils.makeBufferGeometry({
        position: [[-1, -1, 0], [+1, -1, 0], [+1, +1, 0], [-1, +1, 0]],
        index: [[0, 1, 2], [0, 2, 3]]
      })
      const xform = M_mul(M_diag(vec4(1e3, 1e3, 1, 1)), T_translate(vec3(0, 0, -1)))
      geometry.applyMatrix4(xform)

      const material = Utils.makeShaderMaterial(index_glsl, { Main00: 1 })
      material.uniforms = this.uniforms
      this.scene.add(new THREE.Mesh(geometry, material))
    }

    // Draw Three's geometry on foreground (but still I write shader)
    {
      const geometry = Utils.makeBufferGeometry({ position: [[0, 0, 0]] })
      const material = Utils.makeShaderMaterial(index_glsl, { Main01: 1 })
      material.uniforms = this.uniforms
      material.transparent = true // enable(gl.BLEND)

      const mesh = new THREE.Points(geometry, material)
      mesh.onBeforeRender = () => {
        mesh.position.copy(vec3(this.uniforms.U_c.value))
      }
      this.scene.add(mesh)
    }
  }

  start () {
    this.time = null
    this.renderer.setAnimationLoop(() => this.render())
  }

  stop () {
    this.renderer.setAnimationLoop(null)
  }

  render () {
    this._updateSize()
    this._updateTime()
    this._updateUniforms()
    this.renderer.render(this.scene, this.camera)
    this._checkShaderError()
  }
}

const main = async () => {
  patchAframeThree()

  // Create canvas
  const canvas = document.createElement('canvas')
  document.querySelector('#root').appendChild(canvas)

  // Create renderer
  const context = canvas.getContext('webgl2', { alpha: false })
  const renderer = new THREE.WebGLRenderer({ canvas, context })

  // Create app
  const app = new App(renderer)
  await app.init()

  // Setup handler
  const event_names = ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'wheel']
  for (const name of event_names) {
    canvas.addEventListener(name, (e) => app[name] && app[name](e))
  }

  // Start
  app.start()
}

export { main }
