/* eslint camelcase: 0 */

import _ from '../../../web_modules/lodash.js'
import AFRAME from '../../../web_modules/aframe.js'
import * as Utils from '../index.js'

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

AFRAME.registerSystem('input', {
  init () {
    this.initState = {
      mouse: vec2(-1, -1),
      mouseDelta: vec2(0, 0),
      wheel: 0,
      // cf. https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
      buttons: 0,
      // cf. https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
      keys: {}
    }
    this.eventNames = [
      'mousedown', 'mouseup', 'mousemove', 'wheel',
      'keydown', 'keyup'
    ]
    this.methodNames = [
      '__play', '__pause', ...this.eventNames
    ]

    this.state = _.clone(this.initState)
    this.domElement = this.el.sceneEl.canvas

    // Bind methods
    for (const key of this.methodNames) {
      this[key] = this[key].bind(this)
    }

    // NOTE: DIY play/pause callback (aframe's documentation is wrong)
    this.el.sceneEl.addEventListener('play', this.__play)
    this.el.sceneEl.addEventListener('pause', this.__pause)

    this.domElement.tabIndex = 0 // allow keydown/keyup
    this.domElement.focus() // initial key focus
  },

  __play (event) {
    if (event.target !== this.el.sceneEl) { return }
    this.state = _.clone(this.initState)
    for (const name of this.eventNames) {
      this.domElement.addEventListener(name, this[name])
    }
  },

  __pause (event) {
    if (event.target !== this.el.sceneEl) { return }
    for (const name of this.eventNames) {
      this.domElement.removeEventListener(name, this[name])
    }
  },

  tock () {
    _.assign(this.state, _.pick(this.initState, ['mouseDelta', 'wheel']))
  },

  yflip (xy) {
    const { clientHeight: h } = this.el.sceneEl.canvas
    return vec2(xy.x, h - xy.y - 1)
  },

  inputFromMouseEvent (e) {
    this.state.buttons = e.buttons
    this.state.mouse = this.yflip(vec2(e.clientX, e.clientY))
    this.state.mouseDelta = M_add(
      this.state.mouseDelta, vec2(e.movementX, -e.movementY))
  },

  mousedown (event) {
    this.inputFromMouseEvent(event)
  },

  mousemove (event) {
    this.inputFromMouseEvent(event)
  },

  mouseup (event) {
  },

  wheel (event) {
    this.inputFromMouseEvent(event)
    this.state.wheel += event.deltaY
  },

  keydown (event) {
    this.state.keys[event.key] = true
  },

  keyup (event) {
    this.state.keys[event.key] = false
  }
})
