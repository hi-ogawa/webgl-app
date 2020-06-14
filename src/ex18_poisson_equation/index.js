/* eslint camelcase: 0 */

//
// Poisson equation
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import * as UtilsMisc2 from '../utils/misc2.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/coordinate-grid.js'
import '../utils/aframe/init-inspector.js'
import '../utils/aframe/url-geometry.js'
import '../utils/aframe/geometry.js'
import * as ddg from '../utils/ddg.js'
import { hash11 } from '../utils/hash.js'
import { Matrix, MatrixCSC } from '../utils/array.js'

const THREE = AFRAME.THREE
const { $, stringToElement } = UtilsMisc

AFRAME.registerComponent('poisson', {
  dependencies: ['geometry'],

  init () {
    this.geometry = this._getGeometry()
    this.el.addEventListener('componentchanged', (e) => {
      if (e.detail.name === 'geometry') {
        this.geometry = this._getGeometry()
        this._update()
      }
    })
  },

  update () {
    if (!this.geometry) { return }
    this._update()
  },

  _getGeometry () {
    const { geometry } = this.el.components
    return geometry && geometry.geometry
  },

  _update () {
    if (!this.geometry.index) { return }

    const { index, attributes: { position } } = this.geometry
    const verts = new Matrix(position.array, [position.count, 3])
    const f2v = new Matrix(index.array, [index.count / 3, 3])
    const nV = verts.shape[0]

    // Create source
    const intensity = 1
    const numSources = 5
    const sources = []
    for (const i of _.range(numSources)) {
      const j1 = Math.floor(hash11(i ^ 0x1357) * nV)
      const j2 = Math.floor(hash11(i ^ 0x7531) * nV)
      sources.push([j1, intensity])
      sources.push([j2, -intensity])
    }

    // RHS of Poisson equation
    const b = Matrix.empty([nV, 1])
    sources.forEach(([i, v]) => {
      b.data[i] = v
    })

    // Laplacian
    const { laplacian } = ddg.computeMoreV2(verts, f2v)
    const L = MatrixCSC.fromCOO(laplacian)
    L.sumDuplicates()

    // Solve (-L + h I) x = b
    L.negadddiags(1e-6)
    const x = b.clone().muleqs(-1) // TODO: what's good initial guess?
    for (let i = 0; i < 128; i++) {
      L.stepGaussSeidel(x, b)
      const residue = L.matmul(x.clone(), x).subeq(b).dotHS2()
      if (i % 10 === 0) {
        console.log(`[solve] i: ${i}, residue: ${residue}`)
      }
      if (residue < 0.05) {
        break
      }
    }

    // Since KerL = span((1, 1, ...)), we remove that component
    x.subeqs(x.sum() / nV)

    // Visualize solution
    const color = Matrix.empty(verts.shape)
    this.geometry.attributes.color = new THREE.BufferAttribute(color.data, 3)
    for (let i = 0; i < verts.shape[0]; i++) {
      const c = UtilsMisc2.getSignedColor(
        x.data[i], [1, 1, 1], [1, 0, 0], [0, 0, 1])
      color.row(i).set(c)
    }

    // Visualize source points
    for (const [j, v] of sources) {
      const color = v > 0 ? '#f00' : '#00f'
      this.el.querySelector('#points').appendChild(stringToElement(`
        <a-entity
          mixin="point"
          position="${verts.row(j).join(' ')}"
          material="color: ${color}"
        ></a-entity>
      `))
    }
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree()
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
