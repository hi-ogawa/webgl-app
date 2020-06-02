/* global performance */

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import { GUI } from '../../web_modules/three/examples/jsm/libs/dat.gui.module.js'
import * as Utils from './index.js'

/* eslint-disable no-unused-vars, camelcase */
const {
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_sub, M_mul, M_div, M_get
} = Utils
/* eslint-enable no-unused-vars */

const kEventNames = [
  'keydown', 'keyup',
  'mousedown', 'mouseup', 'mousemove', 'wheel'
]

const kInputInit = {
  mouse: vec2(-1, -1),
  mouseDelta: vec2(0, 0),
  wheel: 0,
  // cf. https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
  buttons: 0,
  // cf. https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
  keys: {}
}

class AppBase {
  constructor (canvas, context) {
    this.renderer = new THREE.WebGLRenderer({ canvas, context })
    this.scene = new THREE.Scene()
    this.camera = null
    this.width = 0
    this.height = 0
    this.aspect = 0
    this.time = null
    this.time_delta = null
    this.gui = new GUI()
    this.event_listeners = {}
    this.input = _.clone(kInputInit)
  }

  $ (name) { return this.scene.getObjectByName(name) }

  inputFromMouseEvent (e) {
    this.input.mouse = this.yflip(vec2(e.clientX, e.clientY))
    this.input.mouseDelta =
      M_add(this.input.mouseDelta, vec2(e.movementX, -e.movementY))
    this.input.buttons = e.buttons
  }

  keydown (event) {
    this.input.keys[event.key] = true
  }

  keyup (event) {
    this.input.keys[event.key] = false
  }

  // TODO: by this approach, some mouse event can be lost (cf. https://github.com/mrdoob/three.js/issues/19101)
  mousedown (event) {
    this.inputFromMouseEvent(event)
  }

  mousemove (event) {
    this.inputFromMouseEvent(event)
  }

  wheel (event) {
    this.inputFromMouseEvent(event)
    this.input.wheel += event.deltaY
  }

  yflip (xy) { return vec2(xy.x, this.height - xy.y - 1) }

  // TODO: implement this as mat4 (update logic can be sketchy though)
  windowToCamera (xy) {
    const [x, y] = xy.toArray()
    const m00 = M_get(this.camera.projectionMatrix, 0, 0)
    const m11 = M_get(this.camera.projectionMatrix, 1, 1)
    const [w, h] = [this.width, this.height]
    return vec2((2 * x / w - 1) / m00, (2 * y / h - 1) / m11)
  }

  windowToCameraDelta (dxy) {
    return M_sub(this.windowToCamera(dxy), this.windowToCamera(vec2(0)))
  }

  windowToWorld (xy) {
    return vec3(M_mul(
      this.camera.matrix, vec4(this.windowToCamera(xy), -1, 1)))
  }

  windowToWorldDelta (dxy) {
    return M_sub(this.windowToWorld(dxy), this.windowToWorld(vec2(0)))
  }

  updateSize () {
    const canvas = this.renderer.domElement
    const { clientWidth: w, clientHeight: h } = canvas
    if (this.width === w && this.height === h) { return false }

    this.width = w
    this.height = h
    this.aspect = w / h
    this.renderer.setSize(w, h, /* updateStyle */ false)
    return true
  }

  updateTime () {
    const now = performance.now()
    this.time = this.time || now
    this.time_delta = this.time - now
    this.time = now
  }

  checkShaderError () {
    const badPrograms = this.renderer.info.programs.filter(p => p.diagnostics)
    if (badPrograms.length > 0) {
      this.stop()
      var message = ''
      for (const p of badPrograms) {
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

  async init () {
    this.updateSize()
  }

  start () {
    this.time = null

    for (const name of kEventNames) {
      if (this[name]) {
        const func = this[name].bind(this)
        this.event_listeners[name] = func
        this.renderer.domElement.addEventListener(name, func)
      }
    }

    this.renderer.setAnimationLoop(() => {
      this.update()
      this.render()
      this.endFrame()
    })
  }

  stop () {
    for (const [name, func] of _.toPairs(this.event_listeners)) {
      this.renderer.domElement.removeEventListener(name, func)
    }
    this.renderer.setAnimationLoop(null)
  }

  update () {
    this.updateTime()
    this.updateSize()
  }

  render () {
    this.renderer.render(this.scene, this.camera)
    this.checkShaderError()
  }

  endFrame () {
    this.input = _.clone(kInputInit)
  }
}

const runApp = async (AppKlass, container, contextType, contextAttrs) => {
  // Create canvas
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  canvas.tabIndex = 0 // allow keydown/keyup
  canvas.focus() // initial key focus

  // Create context
  const context = canvas.getContext(
    (contextType || 'webgl'),
    _.assign({ alpha: false, antialias: true }, contextAttrs))

  // Create app
  const app = new AppKlass(canvas, context)
  await app.init()

  // Start
  app.start()
}

export { AppBase, runApp }
