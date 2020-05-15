/* global performance */

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import { GUI } from '../../web_modules/three/examples/jsm/libs/dat.gui.module.js'

const kEventNames = [
  'keydown', 'keyup',
  'mousedown', 'mouseup', 'mousemove', 'wheel'
]

class AppBase {
  constructor (canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      context: canvas.getContext('webgl2', { alpha: false })
    })
    this.scene = new THREE.Scene()
    this.camera = null
    this.width = 0
    this.height = 0
    this.aspect = 0
    this.time = null
    this.time_delta = null
    this.gui = new GUI()
    this.event_listeners = {}
  }

  $ (name) {
    return this.scene.getObjectByName(name)
  }

  yflip (xy) { return new THREE.Vector2(xy.x, this.height - xy.y - 1) }

  updateSize () {
    const canvas = this.renderer.domElement
    const { clientWidth: w, clientHeight: h } = canvas
    if (this.width === w && this.height === h) { return }

    this.width = w
    this.height = h
    this.aspect = w / h
    this.renderer.setSize(w, h, /* updateStyle */ false)
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
}

const runApp = async (AppKlass, container) => {
  // Create canvas
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)

  // Create app
  const app = new AppKlass(canvas)
  await app.init()

  // Start
  app.start()
}

export { AppBase, runApp }
