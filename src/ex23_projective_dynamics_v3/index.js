/* eslint camelcase: 0 */
/* global fetch */

//
// Projective dynamics (Volume strain)
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as misc from '../utils/misc.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/coordinate-grid.js'
import '../utils/aframe/geometry.js'
import '../utils/aframe/simple-controls.js'
import * as glm from '../utils/glm.js'
import * as misc2 from '../utils/misc2.js'
import * as physics from '../utils/physics.js'
import * as ddg from '../utils/ddg.js'
import * as reader from '../utils/reader.js'

const THREE = AFRAME.THREE
const { $, stringToElement } = misc

let wasm_ex05
const wasm_ex05_promise = new Promise(resolve => {
  // cf. misc/wasm/ex05/em-pre.js
  const dir = '../../misc/wasm/ex05/build/js/Release/'
  const js = dir + 'em.js'
  const wasm = dir + 'em.wasm'
  window.__PRE_JS = (Module) => {
    Module.locateFile = () => wasm
    Module.postRun = resolve
    wasm_ex05 = Module
  }
  import(js).catch(() => {
    console.error('TODO: wasm_ex05 is not available')
  })
})

AFRAME.registerComponent('physics-twist', {
  tick () {
    const { keysPressed } = this.el.sceneEl.systems.input.state
    const { n, handles } = this.el.components.physics
    const { add, sub, matmul } = glm.vec3
    const { axisAngle, transpose } = glm.mat3
    const { PI } = Math

    const o = [0.5, 0.5, 0]
    const rot1 = axisAngle([0, 0, 1], 2 * PI * 0.01)
    const rot2 = transpose(rot1)

    if (keysPressed.ArrowUp) {
      for (const i in handles) {
        const { vertex } = handles[i]
        if (vertex >= (n + 1) * (n + 1) * n) {
          const { position } = $('#root #handles').children[i].object3D
          const p = position.toArray()
          const q = add(matmul(rot1, sub(p, o)), o)
          position.fromArray(q)
        }
      }
    }

    if (keysPressed.ArrowDown) {
      for (const i in handles) {
        const { vertex } = handles[i]
        if (vertex >= (n + 1) * (n + 1) * n) {
          const { position } = $('#root #handles').children[i].object3D
          const p = position.toArray()
          const q = add(matmul(rot2, sub(p, o)), o)
          position.fromArray(q)
        }
      }
    }
  }
})

AFRAME.registerComponent('physics', {
  schema: {
    // 0: box with two side fixed and twist
    // 1: box with one side fixed
    // 2: icosphere
    // 3: monkey
    type: { default: 3, oneOf: [0, 1, 2, 3] },
    iterPD: { default: 8, type: 'int' },
    n: { default: 6, type: 'int' },
    stiffness: { default: 2 ** 5 }
  },

  async init () {
    let { type, n, iterPD, stiffness } = this.data
    this.n = n // Use for demo type = 0

    // Load geometry
    let result
    if (type === 3) {
      const data = await fetch('../../misc/data/monkey.mesh').then(resp => resp.text())
      result = reader.readMESH(data)
      stiffness = 2 ** 6
    } else if (type === 2) {
      const data = await fetch('../../misc/data/icosphere.mesh').then(resp => resp.text())
      result = reader.readMESH(data)
      stiffness = 8
    } else {
      result = misc2.makeTetrahedralizedCubeSymmetric(n / 2)
    }
    const { verts, c3xc0 } = result

    // Interaction handles
    this.handles = []
    if (type === 3) {
      // Find vertex around monkey's left ear
      const v = _.sortBy(_.range(verts.shape[0]), (v) => -verts.row(v)[0])[0]
      const vs = [v]
      const ts = [
        [0, 1, 0]
      ]
      for (const [v, t] of _.zip(vs, ts)) {
        this.handles.push({ vertex: v, target: t })
      }
    } else if (type === 2) {
      const vs = [0, 24, 25]
      const l = glm.vec3.distance(verts.row(vs[0]), verts.row(vs[1]))
      const ts = [
        [0, 0, 0],
        [l, 0, 0],
        [0.5 * l, 0, -0.5 * Math.sqrt(3) * l]
      ]
      for (const [v, t] of _.zip(vs, ts)) {
        this.handles.push({ vertex: v, target: t })
      }
    } else {
      for (let k = 0; k <= n; k++) {
        for (let j = 0; j <= n; j++) {
          for (let i = 0; i <= n; i++) {
            if (i > 0 && j > 0 && i < n && j < n) { continue }
            if (k > 0 && k < n) { continue }
            if (type !== 0 && k === n) { continue } // Skip other side

            const v = (n + 1) * (n + 1) * k + (n + 1) * j + i
            const p = verts.row(v)
            this.handles.push({ vertex: v, target: Array.from(p) })
          }
        }
      }
    }

    // boundary surface
    const { c2xc0, d2 } = ddg.computeD2(c3xc0, verts.shape[0])
    const c2xc0B = ddg.computeBoundary(c2xc0, d2)

    // geometry
    this.geometry = new THREE.BufferGeometry()
    this.geometry.index = new THREE.BufferAttribute(c2xc0B.data, 1)
    this.geometry.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    this.geometry.computeVertexNormals()
    $('#root #wireframe').setObject3D('mesh', new THREE.Mesh(this.geometry))
    $('#root #surface').setObject3D('mesh', new THREE.Mesh(this.geometry))

    for (const i in this.handles) {
      const { target } = this.handles[i]
      $('#root #handles').appendChild(stringToElement(`
        <a-entity position="${target.join(' ')}" simple-controls>
          <a-entity mixin="point"></a-entity>
        </a-entity>
      `))
    }

    // solver
    this.solver = new physics.Example02()
    this.solver.init(verts, c3xc0, this.handles, stiffness)
    this.solver.iterPD = iterPD
    this.ready = true

    // Use wasm code if available
    await wasm_ex05_promise
    if (wasm_ex05) {
      this.solver.setupWasm(wasm_ex05)
    }
  },

  tick () {
    if (!this.ready) { return }

    // Update interaction handle constraint
    for (const i in this.handles) {
      const { target } = this.handles[i]
      const el = $('#root #handles').children[i]
      glm.vec3.copy(target, el.object3D.position.toArray())

      // TODO: find a better way to choose handle
      el.components['simple-controls'].focused = true
    }

    // Solver update
    this.solver.update()

    // Geometry update
    this.geometry.computeVertexNormals()
    this.geometry.attributes.position.needsUpdate = true
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree()
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
