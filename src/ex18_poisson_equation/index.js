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

const THREE = AFRAME.THREE
const { $, stringToElement } = UtilsMisc

// Convert to our format
const geometryToVertsAndF2v = (geometry) => {
  const { index, attributes: { position } } = geometry
  return {
    verts: _.chunk(position.array, 3),
    f2v: _.chunk(index.array, 3)
  }
}

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

    // Create color attribute
    {
      const nV = this.geometry.attributes.position.count
      const color = _.range(nV).map(() => [1, 1, 1])
      const colorAttr = new THREE.Float32BufferAttribute(color.flat(), 3)
      this.geometry.attributes.color = colorAttr
    }

    const { verts, f2v } = geometryToVertsAndF2v(this.geometry)
    const nV = verts.length

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

    // Define RHS of Poisson equation
    // (integrated) dual 2-form i.e. delta source integrated at dual face
    const rho_dual = _.range(nV).map(i => 0)
    sources.forEach(([i, v]) => { rho_dual[i] = v })

    // Solve
    const u = ddg.solvePoisson(verts, f2v, rho_dual)

    // Draw solution
    {
      const color = _.range(nV).map(i =>
        UtilsMisc2.getSignedColor(u[i], [1, 1, 1], [1, 0, 0], [0, 0, 1]))
      const attr = this.geometry.attributes.color
      attr.array.set(color.flat())
      attr.needsUpdate = true
    }

    // Draw source points
    for (const [j, v] of sources) {
      const color = v > 0 ? '#f00' : '#00f'
      this.el.querySelector('#points').appendChild(stringToElement(`
        <a-entity
          mixin="point"
          position="${verts[j].join(' ')}"
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
