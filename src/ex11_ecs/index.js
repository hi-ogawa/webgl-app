/* eslint camelcase: 0 */

//
// Experiment with ECS
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'

/* eslint-disable no-unused-vars */
const THREE = AFRAME.THREE
const { PI, cos, sin, pow } = Math
const {
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_sub, M_mul, M_div,
  T_translate, T_axisAngle,
  dot, inverse, cross, normalize,
  diag, pow2, smoothstep01, dot2, outer, outer2,
  toColor
} = Utils
/* eslint-enable no-unused-vars */

const patchAframeThree = (aframe) => {
  const { Object3D } = aframe.THREE
  const patches = [
    [
      Object3D.prototype,
      {
        // cf. Camera3dHelper.update
        applyMatrix4 () { this.applyMatrix(...arguments) }
      }
    ]
  ]
  for (const [target, data] of patches) {
    Object.assign(target, data)
  }
}

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

  __play () {
    this.state = _.clone(this.initState)
    for (const name of this.eventNames) {
      this.domElement.addEventListener(name, this[name])
    }
  },

  __pause () {
    for (const name of this.eventNames) {
      this.domElement.removeEventListener(name, this[name])
    }
  },

  tock () {
    this.state = _.clone(this.initState)
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

AFRAME.registerComponent('orbit-controls', {
  init () {
    this.object = this.el.object3D
    this.camera = this.el.object3DMap.camera
    if (!this.camera) {
      throw new Error('orbit-controls')
    }
    this.helper = new UtilsMisc.Camera3dHelper(this.object)
    this.helper.init()
  },

  getWindowToCamera () {
    const { clientWidth: w, clientHeight: h } = this.el.sceneEl.canvas

    const windowToNdc = [
      T_translate(vec3(-1, -1, 0)),
      diag(vec4(2 / w, 2 / h, 1, 1))
    ].reduce(M_mul)

    // force z = -1
    const ndcToCamera = [
      T_translate(vec3(0, 0, -1)), // to z = -1
      diag(vec4(1, 1, 0, 1)), // to z = 0
      inverse(this.camera.projectionMatrix)
    ].reduce(M_mul)

    return M_mul(ndcToCamera, windowToNdc)
  },

  tick () {
    const { mouseDelta, buttons, keys, wheel } = this.el.sceneEl.systems.input.state
    const { clientWidth: w, clientHeight: h } = this.el.sceneEl.canvas

    if (wheel !== 0) {
      this.helper.zoom(-wheel / 800)
    }

    if (buttons === 1) {
      if (keys.Shift) {
        this.helper.move(
          vec2(M_mul(mat3(this.getWindowToCamera()), M_mul(-1, vec3(mouseDelta, 0)))))
      }

      if (keys.Control) {
        this.helper.orbit(
          M_mul(2 * PI,
            M_mul(vec2(-1, 1),
              M_div(mouseDelta, vec2(w, h)))))
      }
    }
  }
})

// NOTE: Line primitive cannot be registered as geometry
AFRAME.registerComponent('coordinate', {
  schema: {
    x: { default: true },
    y: { default: true },
    z: { default: true },
    xy: { default: false },
    yz: { default: false },
    zx: { default: true },
    size: { default: 10, type: 'int' }
  },

  init () {
    this.axes = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial())
    this.grids = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial())
    const object = new THREE.Group()
    object.add(this.axes)
    object.add(this.grids)
    this.el.setObject3D(this.attrName, object)
  },

  update (data) {
    _.assign(data, this.data)

    // axes
    {
      const axes = ['x', 'y', 'z']
        .map((k, i) => data[k] && i)
        .filter(v => v !== false)
      this.axes.geometry.dispose()
      this.axes.geometry = Utils.makeBufferGeometry(
        UtilsMisc.makeAxes(axes, data.size))
      this.axes.material.setValues({
        linewidth: 2,
        vertexColors: true
      })
      this.axes.frustumCulled = false
    }

    // grids
    {
      const position = [];
      ['yz', 'zx', 'xy'].forEach((k, i) => {
        if (data[k]) {
          position.push(UtilsMisc.makeGrid(i, data.size))
        }
      })
      this.grids.geometry.dispose()
      this.grids.geometry = Utils.makeBufferGeometry({
        position: position.flat()
      })
      this.grids.material.setValues({
        linewidth: 1.5,
        color: '#444'
      })
      this.grids.frustumCulled = false
    }
  },

  remove () {
    this.el.removeObject3D(this.attrName)
  }
})

const main = () => {
  patchAframeThree(AFRAME)
  const $ = (...args) => document.querySelector(...args)
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
