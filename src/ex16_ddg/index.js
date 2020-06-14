/* eslint camelcase: 0 */
/* global performance */

//
// Experiment with discrete differential geometry
// (Cf. Crane's DDG course note http://brickisland.net/DDGSpring2020)
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
import * as Reader from '../utils/reader.js'
import * as glm from '../utils/glm.js'
import * as ddg from '../utils/ddg.js'
import { Matrix, MatrixCSC } from '../utils/array.js'

const THREE = AFRAME.THREE
const { $ } = UtilsMisc

const measure = (label, func) => {
  const t0 = performance.now()
  const result = func()
  const t1 = performance.now()
  console.log(`[measure:${label}] ${(t1 - t0).toPrecision(5)} msec`)
  return result
}

AFRAME.registerComponent('mean-curvature-flow', {
  schema: {
    dt: { default: 1 },
    iteration: { default: 4, type: 'int' }, // Gauss-Seidel iteration
    run: { default: false },
    reset: { default: false }
  },

  update () {
    if (this.data.run) { this._run() }
    if (this.data.reset) { this._reset() }
    this.data.run = false
    this.data.reset = false
  },

  _run () {
    const { dt, iteration } = this.data
    const { viewer } = this.el.components
    const { verts, laplacian } = viewer.precomputed

    // Solve PDE (implicit integration)
    //   ∂tf = Lf
    //   ~~> f' = f + dt Lf'
    //   <=> (I - dt L) f' = f

    // This is strictly diagonally dominant (thus positive definite)
    // So, Gauss-Seidel converges.
    const A = laplacian.clone().idsubmuls(dt) // A = I - dt * L
    const x = verts
    const b = verts.clone()

    measure('gauss-seidel', () => {
      _.range(iteration).forEach(() => {
        A.stepGaussSeidel(x, b)
      })
    })

    const residue = A.matmul(x.clone(), x).subeq(b).dotHS2()
    console.log(`gauss-seidel residue: ${residue}`)

    this._updateViewer()
  },

  _reset () {
    const { viewer } = this.el.components
    const { verts, initVerts } = viewer.precomputed
    verts.copy(initVerts)
    this._updateViewer()
  },

  _updateViewer () {
    const { viewer } = this.el.components
    const { verts, f2v } = viewer.precomputed

    // Recompute
    let { laplacian, hodge0, kg } = ddg.computeMoreV2(verts, f2v)
    laplacian = MatrixCSC.fromCOO(laplacian)
    laplacian.sumDuplicates()
    _.assign(viewer.precomputed, { laplacian, hodge0, kg })

    // Update geometry
    viewer.geometry.attributes.position.needsUpdate = true
    viewer.geometry.computeVertexNormals()

    // Update viewer
    viewer._update()
  }
})

AFRAME.registerComponent('viewer', {
  schema: {
    asset: { type: 'selector' },
    type: { default: 'mean', oneOf: ['mean', 'gaussian'] },
    density: { default: false },
    scaleMean: { default: 0.1 },
    scaleGaussian: { default: 0.1 }
  },

  init () {
    this.precomputed = null
    this.geometry = new THREE.BoxBufferGeometry()
    this.mesh = new THREE.Mesh(this.geometry)
    this.el.setObject3D('mesh', this.mesh)
  },

  async update () {
    if (!this.precomputed) {
      await UtilsMisc.promiseLoaded(this.data.asset)
      this._init()
      return
    }
    this._update()
  },

  _init () {
    const { data } = this.data.asset
    let { verts, f2v } = Reader.readOFF(data, true)

    verts = new Matrix(verts, [verts.length / 3, 3])
    f2v = new Matrix(f2v, [f2v.length / 3, 3])
    UtilsMisc2.normalizePositionsV2(verts)

    const color = Matrix.empty(verts.shape)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.index = new THREE.BufferAttribute(f2v.data, 1)
    this.geometry.attributes.position = new THREE.BufferAttribute(verts.data, 3)
    this.geometry.attributes.color = new THREE.BufferAttribute(color.data, 3)
    this.geometry.computeVertexNormals()
    this.mesh.geometry = this.geometry

    let { laplacian, hodge0, kg } = ddg.computeMoreV2(verts, f2v)
    laplacian = MatrixCSC.fromCOO(laplacian)
    laplacian.sumDuplicates()

    const hn2 = Matrix.empty(verts.shape) // here only allocation. compute in `_update`
    const initVerts = verts.clone()

    this.precomputed = {
      verts, f2v, hn2, laplacian, hodge0, kg, initVerts
    }
    this._update()
  },

  _update () {
    const { type, density, scaleMean, scaleGaussian } = this.data
    const { color: colorAttr, normal: normalAttr } = this.geometry.attributes
    const { verts, laplacian, hodge0, hn2, kg } = this.precomputed

    const kColor0 = [1, 1, 1]
    const kColorP = [1, 0, 0]
    const kColorN = [0, 0, 1]

    if (type === 'mean') {
      // Mean curvature as dual-2-form
      laplacian.matmul(hn2, verts)

      const nV = verts.shape[0]
      const color = new Matrix(colorAttr.array, [nV, 3])
      const normal = new Matrix(normalAttr.array, [nV, 3])
      colorAttr.needsUpdate = true

      for (let i = 0; i < nV; i++) {
        const h = hn2.row(i)
        const n = normal.row(i)
        const sign = Math.sign(glm.v3.dot(h, n))
        let magnitude = glm.v3.length(h)
        if (density) {
          magnitude /= hodge0.data[i] // as primal-0-form (i.e. density)
        }
        color.row(i).set(
          UtilsMisc2.getSignedColor(sign * magnitude / scaleMean, kColor0, kColorP, kColorN))
      }
    }

    if (type === 'gaussian') {
      const nV = verts.shape[0]
      const color = new Matrix(colorAttr.array, [nV, 3])
      colorAttr.needsUpdate = true

      const kColor0 = [1, 1, 1]
      const kColorP = [1, 0, 0]
      const kColorN = [0, 0, 1]
      for (let i = 0; i < nV; i++) {
        let k = kg.data[i]
        if (density) {
          k /= hodge0.data[i] // as primal-0-form (i.e. density)
        }
        color.row(i).set(
          UtilsMisc2.getSignedColor(k / scaleGaussian, kColor0, kColorP, kColorN))
      }
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
