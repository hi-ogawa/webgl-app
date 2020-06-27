/* eslint camelcase: 0 */

//
// Harmonic parametrization (typical example for Laplace equation with Dirichlet boundary condition)
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/coordinate-grid.js'
import '../utils/aframe/init-inspector.js'
import '../utils/aframe/url-geometry.js'
import '../utils/aframe/geometry.js'
import '../utils/aframe/line-ext.js'
import * as ddg from '../utils/ddg.js' // eslint-disable-line
import { Matrix } from '../utils/array.js'

const THREE = AFRAME.THREE
const { $ } = UtilsMisc

class WorkerHelper {
  constructor (src) {
    const blob = new window.Blob([src], { type: 'application/javascript' })
    const url = window.URL.createObjectURL(blob)
    const worker = new window.Worker(url, { type: 'module' })
    _.assign(this, { worker })
  }

  async run (message) {
    return await new Promise(resolve => {
      this.worker.onmessage = ({ data }) => resolve(data)
      this.worker.postMessage(message)
    })
  }
}

AFRAME.registerComponent('harmonic-parametrization', {
  dependencies: ['geometry'],
  init () {
    this.geometry = this._getGeometry()
    if (this.geometry) {
      this._init()
    }
    this.el.addEventListener('componentchanged', (e) => {
      if (e.detail.name === 'geometry') {
        this.geometry = this._getGeometry()
        this._init()
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

  async _init () {
    if (!this.geometry.index) { return }

    const { index, attributes: { position } } = this.geometry

    // Run solver in worker thread
    const helper = new WorkerHelper(`
      import * as ddg from '${document.location.href.match(/(.*)\/.*/)[1]}/../utils/ddg.js'
      import { Matrix } from '${document.location.href.match(/(.*)\/.*/)[1]}/../utils/array.js'

      self.onmessage = ({ data: [array0, array1] }) => {
        const verts = new Matrix(array0, [array0.length / 3, 3])
        const c2xc0 = new Matrix(array1, [array1.length / 3, 3])
        const solver = new ddg.HarmonicParametrizationSolver()
        const { u, v } = solver.compute(verts, c2xc0, 1024, 1e-2)
        self.postMessage([u.data, v.data])
      }
    `)
    const [u, v] = await helper.run([position.array, index.array])
    const nC0 = u.length
    const uv = Matrix.empty([nC0, 2])
    _.range(nC0).forEach(i => uv.row(i).set([0.5 + 0.5 * u[i], 0.5 - 0.5 * v[i]]))
    this.geometry.attributes.uv = new THREE.BufferAttribute(uv.data, 2)
  },

  _update () {
    if (!this.geometry.index) { }
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree()
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
