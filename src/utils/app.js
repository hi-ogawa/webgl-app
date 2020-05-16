/* global performance */

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import { GUI } from '../../web_modules/three/examples/jsm/libs/dat.gui.module.js'
import * as Utils from './index.js'

const { vec2 } = Utils

const kEventNames = [
  'keydown', 'keyup',
  'mousedown', 'mouseup', 'mousemove', 'wheel'
]

// cf. https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
const kInputInit = {
  mouse: vec2(-1, -1),
  mouseDelta: vec2(0, 0),
  wheel: 0,
  buttons: 0,
  ctrlKey: 0,
  shiftKey: 0,
  altKey: 0
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
    this.input.mouseDelta = vec2(e.movementX, -e.movementY)
    for (const key of ['buttons', 'ctrlKey', 'shiftKey', 'altKey']) {
      this.input[key] = e[key]
    }
  }

  mousedown (event) {
    this.inputFromMouseEvent(event)
  }

  mousemove (event) {
    this.inputFromMouseEvent(event)
  }

  wheel (event) {
    this.inputFromMouseEvent(event)
    this.input.wheel = event.deltaY
  }

  yflip (xy) { return vec2(xy.x, this.height - xy.y - 1) }

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
