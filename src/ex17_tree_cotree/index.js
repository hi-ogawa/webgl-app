/* eslint camelcase: 0 */

//
// Tree Cotree decomposition and homology generators
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
import '../utils/aframe/geometry.js'
import * as glm from '../utils/glm.js'
import * as ddg from '../utils/ddg.js'
import { hash11 } from '../utils/hash.js'

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

AFRAME.registerComponent('tree-cotree', {
  dependencies: ['geometry'],
  schema: {
    loops: { default: true },
    tree: { default: false },
    cotree: { default: false },
    dualWireframe: { default: false }
  },

  init () {
    this.el.addEventListener('componentchanged', (e) => {
      if (e.detail.name === 'geometry') {
        this._update(this.el.components.geometry.geometry)
      }
    })
  },

  update () {
    this._update(this.el.components.geometry.geometry)
  },

  _update (geometry) {
    // Geometry to verts/f2v
    const { index, attributes: { position } } = geometry
    const verts = _.chunk(position.array, 3)
    const f2v = _.chunk(index.array, 3)

    // Compute
    const nV = verts.length
    const topology = ddg.computeTopology(f2v, nV)
    const { e2v, v2ve, f2fe, e2f } = topology
    const rootV = 0
    const rootF = 0
    const treeCotree = ddg.computeTreeCotree(rootV, rootF, v2ve, f2fe, e2f)
    const { edgesF, edgesV, loops } = treeCotree
    const nE = e2v.length

    // Dual mesh data
    // NOTE:
    // - Dual mesh is not necessarily triangulated
    // - Use "geometric center" (aka centroid) instead of "circum center"
    //   because "circum center" is not in interior of right/obtuse triangle
    // - Push a little bit to the normal
    const makeDualVerts = (verts, f2v) => {
      const { add, sub, mul, div, cross, normalize } = glm
      return f2v.map(([v0, v1, v2]) => {
        const [p0, p1, p2] = [verts[v0], verts[v1], verts[v2]]
        const c = div(add(p0, add(p1, p2)), 3)
        const n = normalize(cross(sub(p1, p0), sub(p2, p0)))
        return add(c, mul(0.01, n))
      })
    }
    const vertsDual = makeDualVerts(verts, f2v)
    const e2fSlim = e2f.map(([[e1, o1], [e2, o2]]) => [e1, e2]) // remove orientation

    // Dual mesh edges
    this.el.removeObject3D('dual-wireframe')
    if (this.data.dualWireframe) {
      const geometry = Utils.makeBufferGeometry({
        position: vertsDual,
        index: e2fSlim
      })
      const material = new THREE.LineBasicMaterial({ linewidth: 1, color: '#fff' })
      const object = new THREE.LineSegments(geometry, material)
      this.el.setObject3D('dual-wireframe', object)
    }

    // Root
    this.el.removeObject3D('tree-rootV')
    if (this.data.tree) {
      const object = UtilsMisc.makeDiskPoints([verts[rootF]], [[0, 0.5, 1]])
      object.material.depthTest = false
      this.el.setObject3D('tree-rootV', object)
    }

    this.el.removeObject3D('tree-rootF')
    if (this.data.loops || this.data.cotree) {
      const object = UtilsMisc.makeDiskPoints([vertsDual[rootF]], [[1, 0.5, 0]])
      object.material.depthTest = false
      this.el.setObject3D('tree-rootF', object)
    }

    // Tree
    this.el.removeObject3D('tree')
    if (this.data.tree) {
      const edgesV_index = _.range(nE).filter(e => edgesV[e]).map(e => e2v[e])
      const geometry = Utils.makeBufferGeometry({
        position: verts,
        index: edgesV_index
      })
      const material = new THREE.LineBasicMaterial({ linewidth: 2, color: '#6af' })
      const object = new THREE.LineSegments(geometry, material)
      this.el.setObject3D('tree', object)
    }

    // Cotree
    this.el.removeObject3D('cotree')
    if (this.data.cotree) {
      const edgesF_index = _.range(nE).filter(e => edgesF[e]).map(e => e2fSlim[e])
      const geometry = Utils.makeBufferGeometry({
        position: vertsDual,
        index: edgesF_index
      })
      const material = new THREE.LineBasicMaterial({ linewidth: 2, color: '#0f0' })
      const object = new THREE.LineSegments(geometry, material)
      this.el.setObject3D('cotree', object)
    }

    // Loops (homology generators)
    this.el.removeObject3D('loops')
    if (this.data.loops) {
      const objectGroup = new THREE.Group()
      const n = loops.length
      for (const i of _.range(n)) {
        const loop = loops[i]
        const loopIndex = loop.map(e => e2fSlim[e])
        const geometry = Utils.makeBufferGeometry({
          // Jitter position so that loops won't exactly overlap each other
          position: vertsDual.map((p, j) => glm.add(p, (hash11(i * j) - 0.5) * 0.02)),
          index: loopIndex
        })
        const color = Utils.toColorHex(Utils.hue(i / n))
        const material = new THREE.LineBasicMaterial({ linewidth: 2, color: `#${color}` })
        const object = new THREE.LineSegments(geometry, material)
        objectGroup.add(object)
      }
      this.el.setObject3D('loops', objectGroup)
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
