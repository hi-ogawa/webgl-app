/* eslint camelcase: 0 */

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

/* eslint-disable no-unused-vars */
const THREE = AFRAME.THREE
const { PI, cos, sin, pow, sqrt, cosh, sinh, acos, atan2 } = Math
const {
  vec2, vec3, vec4, mat2, mat3, mat4,
  M_add, M_sub, M_mul, M_div, M_get,
  T_translate, T_axisAngle, T_sphericalToCartesian, T_frameXZ,
  dot, inverse, cross, normalize, transpose, mix, smoothstep,
  diag, pow2, smoothstep01, dot2, outer, outer2,
  eigen_mat2, sqrt_mat2, hue,
  toColor, toColorHex
} = Utils
const { $, $$, stringToElement } = UtilsMisc
/* eslint-enable no-unused-vars */

const getSignedColor = (value, color0, colorP, colorN) => {
  // Piecewise linear with knot at value = 0
  return value > 0
    ? glm.mix(color0, colorP, value)
    : glm.mix(color0, colorN, -value)
}

// Mutates f
const solveImplicit = (f, L, dt) => {
  // ∂tf = Lf
  // ~~> f' = f + dt Lf'
  // <=> (I - dt L) f' = f

  const { add, sub, mul, div } = glm
  const type = 'gauss-seidel'

  // Power series (I - A)^{-1} = \sum_n A^n
  // TODO: something doesn't seem right...
  if (type === 'power') {
    const N = 4 // "N = 1" is equivalent explicit
    let g = _.cloneDeep(f)
    for (const n of _.range(1, N)) { // eslint-disable-line
      // g_tmp = dt L g
      // f += g_tmp
      // g = g_tmp
      const tmp = _.range(f.length).map(() => [0, 0, 0])
      for (const i of _.range(f.length)) {
        for (const [j, u] of L[i]) {
          tmp[i] = add(tmp[i], mul(dt * u, g[j]))
        }
        f[i] = add(f[i], tmp[i])
      }
      g = tmp
    }
  }

  // Gauss-Seidel
  if (type === 'gauss-seidel') {
    const N = 4
    const g = _.cloneDeep(f)
    for (const n of _.range(N)) { // eslint-disable-line
      for (const i of _.range(f.length)) {
        let diag = 0
        let rhs = g[i]
        for (const [j, u] of L[i]) {
          if (j === i) {
            diag = 1 - dt * u
            continue
          }
          rhs = sub(rhs, mul(-dt * u, f[j]))
        }
        f[i] = div(rhs, diag)
      }
    }
  }
}

AFRAME.registerComponent('mean-curvature-flow', {
  schema: {
    dt: { default: 0.5 },
    run: { default: false },
    reset: { default: false },
    type: { default: 'implicit', oneOf: ['explicit', 'implicit'] }
  },

  update () {
    if (this.data.run) { this._run() }
    if (this.data.reset) { this._reset() }
    this.data.run = false
    this.data.reset = false
  },

  _run () {
    const { dt, type } = this.data
    const { viewer } = this.el.components
    const { verts, L } = viewer.precomputed
    const nV = verts.length

    if (type === 'explicit') {
      // Compute HN2
      const HN2 = ddg.computeMeanCurvature(verts, L)

      // NOTE: HN2_primal doesn't seem to behave well even for small `dt` (TODO: prove it)
      // const HN2_primal = _.zip(HN2, more.hodge0).map(([hn2, h0]) => glm.div(hn2, h0))

      // Explicit PDE integration
      for (const i of _.range(nV)) {
        verts[i] = glm.add(verts[i], glm.mul(dt, HN2[i]))
      }
    }

    if (type === 'implicit') {
      solveImplicit(verts, L, dt)
    }

    // Update viewer
    this._updateViewer()
  },

  _reset () {
    // Reset to `initVerts`
    const { viewer } = this.el.components
    const { initVerts } = viewer.precomputed
    _.assign(viewer.precomputed, { verts: initVerts })
    this._updateViewer()
  },

  _updateViewer () {
    const { viewer } = this.el.components

    // Recompute
    let { verts, f2v, topology, more, L } = viewer.precomputed
    const nV = verts.length
    more = ddg.computeMore(verts, f2v, topology)
    L = ddg.computeLaplacian(nV, topology.e2v, more.hodge1)
    _.assign(viewer.precomputed, { more, L })

    // Update geometry
    const { position: positionAttr } = viewer.geometry.attributes
    positionAttr.array.set(verts.flat())
    positionAttr.needsUpdate = true
    viewer.geometry.computeVertexNormals()
    viewer._update()
  }
})

AFRAME.registerComponent('viewer', {
  schema: {
    asset: { type: 'selector' },
    type: { default: 'mean', oneOf: ['mean', 'gaussian'] },
    scaleMean: { default: 10.0 },
    scaleGaussian: { default: 20.0 }
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
    let { verts, f2v } = Reader.readOFF(data)
    verts = UtilsMisc2.normalizePositions(verts)

    const nV = verts.length
    const color = _.range(nV).map(() => [1, 1, 1])

    this.geometry.dispose()
    this.geometry = Utils.makeBufferGeometry({ position: verts, index: f2v, color })
    this.geometry.computeVertexNormals()
    this.mesh.geometry = this.geometry

    // Pre-computation
    const topology = ddg.computeTopology(f2v, nV)
    const more = ddg.computeMore(verts, f2v, topology)
    const { e2v } = topology
    const { hodge1 } = more
    const L = ddg.computeLaplacian(nV, e2v, hodge1)
    this.precomputed = {
      verts,
      f2v,
      topology,
      more,
      L,
      initVerts: _.cloneDeep(verts)
    }
    this._update()
  },

  _update () {
    const { type } = this.data
    const { color: colorAttr, normal: normalAttr } = this.geometry.attributes

    if (type === 'mean') {
      const { scaleMean } = this.data
      const { verts, L, more: { hodge0 } } = this.precomputed

      // Discrete mean curvature as primal 0-form
      // (Unit sphere corresponds to -2)
      const HN2 = ddg.computeMeanCurvature(verts, L)
      const HN2_primal = _.zip(HN2, hodge0).map(([hn2, h0]) => glm.div(hn2, h0))

      // Sign wrt global orientation (convex => -1, concave => +1)
      const HN2_sign = _.zip(HN2, _.chunk(normalAttr.array, 3)).map(
        ([hn2, n]) => Math.sign(glm.dot(hn2, n)))

      // HN2's magnitude
      const HN2_magnitude = HN2_primal.map(hn2 => glm.length(hn2))

      const kColor0 = [1, 1, 1]
      const kColorP = [1, 0, 0]
      const kColorN = [0, 0, 1]
      const color = _.zip(HN2_sign, HN2_magnitude).map(([s, m]) =>
        getSignedColor(s * m / scaleMean, kColor0, kColorP, kColorN))

      colorAttr.array.set(color.flat())
      colorAttr.needsUpdate = true
    }

    if (type === 'gaussian') {
      const { scaleGaussian } = this.data
      const { more: { angleSum, hodge0 } } = this.precomputed

      // Discrete mean curvature as primal 0-form
      const kG = _.zip(angleSum).map(a => (2 * PI) - a)
      const kG_primal = _.zip(kG, hodge0).map(([a, h]) => a / h)

      const kColor0 = [1, 1, 1]
      const kColorP = [1, 0, 0]
      const kColorN = [0, 0, 1]
      const color = kG_primal.map(k =>
        getSignedColor(k / scaleGaussian, kColor0, kColorP, kColorN))

      colorAttr.array.set(color.flat())
      colorAttr.needsUpdate = true
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
