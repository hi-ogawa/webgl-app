/* eslint-disable */

//
// Screen quad fragment shader with interaction
//

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import { Vector2 } from '../../web_modules/three/build/three.module.js'
import { GUI } from '../../web_modules/three/examples/jsm/libs/dat.gui.module.js'
import { Quad } from '../utils/index.js'

class App {
  constructor (renderer) {
    this.renderer = renderer
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.width = this.height = 0
    this.uniforms = {
      U_time: { value: 0 },
      U_resolution: { value: new Vector2(0, 0) },
      U_view_xy: { value: new Vector2(0, 0) },
      U_view_zoom: { value: 0 }, // = log_2(scale)
      U_c: { value: new Vector2(0, 0) },
      U_use_mouse: { value: 0 }
    }
    this.time = null
    this.gui = new GUI()
    this._resetSize()
  }

  _resetSize () {
    const canvas = this.renderer.domElement

    const { clientWidth: w_css, clientHeight: h_css } = canvas
    if (this.width == w_css && this.height == h_css) { return }

    this.width = w_css
    this.height = h_css

    // WebGLRenderer.setSize updates canvas's width and height used below
    this.renderer.setSize(w_css, h_css, /* updateStyle */ false)

    const { width: w_res, height: h_res } = canvas
    this.uniforms.U_resolution.value.fromArray([w_res, h_res])
  }

  _updateTime () {
    const now = performance.now()
    this.time = this.time || now
    this.uniforms.U_time.value += (this.time - now) / 1000
    this.time = now
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
        this.uniforms.U_view_xy.value.add(new Vector2(-dx, +dy))
      } else {
        const { U_view_xy, U_view_zoom, U_c } = this.uniforms
        U_c.value
          .set(x, this._yflip(y))
          .add(U_view_xy.value)
          .multiplyScalar(Math.pow(2, U_view_zoom.value))
      }
    }
  }

  wheel (event) {
    const { clientX: x, clientY: y, deltaY: dy } = event
    const dzoom = dy / 1024
    this.uniforms.U_view_zoom.value += dzoom

    // Preserve "mouse"
    // <=> scale' * (mouse + view') = scale * (mouse + view)
    // <=> view' = - mouse + (scale / scale') * (mouse + view)
    //           = - mouse + (mouse + view) / pow(2, dzoom)
    const vec = this.uniforms.U_view_xy.value
    const mouse_xy = [x, this._yflip(y)]
    vec.fromArray(
      _.zip(vec.toArray(), mouse_xy).map(
        ([v, m]) => -m + (m + v) / Math.pow(2, dzoom)))
  }

  async init () {
    // Gui
    const gui_params = {
      play: true,
      use_mouse: false
    }
    this.gui.add(gui_params, 'play').onFinishChange(b => b ? this.start() : this.stop())
    this.gui.add(gui_params, 'use_mouse').onFinishChange(b => { this.uniforms.U_use_mouse.value = b ? 1 : 0 })

    // Screen quad with custom shader
    const geometry = new Quad()
    geometry.frustumCulled = false // disable camera frustum culling

    const glsl_src = await (await fetch('./index.glsl')).text()
    const glsl_header = [
      '#version 300 es',
      'precision mediump float;',
      'precision mediump int;'
    ]
    const material = new THREE.RawShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: [...glsl_header, '#define COMPILE_vertex', glsl_src].join('\n'),
      fragmentShader: [...glsl_header, '#define COMPILE_fragment', glsl_src].join('\n')
    })
    this.scene.add(new THREE.Mesh(geometry, material))
  }

  start () {
    this.time = null
    this.renderer.setAnimationLoop(() => this.render())
  }

  stop () {
    this.renderer.setAnimationLoop(null)
  }

  render () {
    this._resetSize()
    this._updateTime()
    this.renderer.render(this.scene, this.camera)
    this._checkShaderError()
  }
}

const main = async () => {
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
