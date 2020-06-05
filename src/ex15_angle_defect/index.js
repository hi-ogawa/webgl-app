/* eslint camelcase: 0, no-eval: 0 */

//
// Angle defect as Dirac-delta gaussian curvature
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/coordinate-grid.js'
import '../utils/aframe/simple-controls.js'
import '../utils/aframe/line-ext.js'
import '../utils/aframe/circle-arc.js'
import { GUI } from '../../web_modules/three/examples/jsm/libs/dat.gui.module.js'

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

AFRAME.registerComponent('point', {
  init () {
    this.object = UtilsMisc.makeDiskPoints([[0, 0, 0]], [[1, 1, 1]])
    this.object.material.depthTest = true
    this.el.object3D.add(this.object)
  },

  remove () {
    this.el.object3D.remove(this.object)
  }
})

AFRAME.registerComponent('face-visualizer', {
  schema: {
    v1: { type: 'vec3' },
    v2: { type: 'vec3' }
  },

  init () {
    let { v1, v2 } = this.data
    v1 = vec3(..._.values(v1))
    v2 = vec3(..._.values(v2))

    const phi = acos(dot(v1, v2))
    const t = atan2(v1.y, v1.x)
    const color = hue(t / (2 * PI))
    const colorProp = `color: #${toColorHex(color)}`

    // const x = normalize(v1)
    // const z = normalize(cross(x, v2))
    // const y = cross(z, x)
    // const xform = mat4(mat3(x, y, z))
    // T_frameXZ(v1, cross(v1, v2))

    this.el.appendChild(stringToElement(/* html */`
      <a-entity>
        <!-- disk sector -->
        <a-entity
          geometry="primitive: circle; thetaLength: ${phi * 180 / PI};"
          material="side: double; ${colorProp}"
        ></a-entity>

        <!-- face normal -->
        <a-entity
          line="start: 0 0 0; end: 0 0 1; ${colorProp}"
          line-ext="linewidth: 2"
        ></a-entity>

        <!-- geodesic triangle -->
        <a-entity circle-arc="${colorProp}; linewidth: 2" rotation="90 0 0"></a-entity>
        <a-entity rotation="0 0 ${phi * 180 / PI}">
          <a-entity circle-arc="${colorProp}; linewidth: 2" rotation="90 0 0"></a-entity>
        </a-entity>
      </a-entity>
    `))
    this.el.object3D.applyMatrix4(T_frameXZ(v1, cross(v1, v2)))
  }
})

AFRAME.registerComponent('main', {
  init () {
    this.gui = new GUI()
    this.guiParams = { angle: 0 }
    this.gui.add(this.guiParams, 'angle', -1e3, 1e3, 1e-3)

    this._update()

    // Refresh when vertex's position changed
    $$('#vertices a-entity').forEach(el => {
      el.addEventListener('simple-controls-object-changed', () => {
        // Project to sphere
        const { position } = el.object3D
        position.copy(normalize(position))

        // Update
        this._update()
      })
    })
  },

  _update () {
    // Traverse vertices
    const verts = $$('#vertices a-entity').map(el => el.object3D.position)
    const n = verts.length

    // Get normals and angular defect
    const normals = []
    const angles = []
    for (const i of _.range(n)) {
      const v1 = verts[i]
      const v2 = verts[(i + 1) % n]
      normals.push(normalize(cross(v1, v2)))
      angles.push(acos(dot(v1, v2)))
    }

    // Visualization
    $('#visualization').innerHTML = ''
    for (const i of _.range(n)) {
      const v1 = verts[i]
      const v2 = verts[(i + 1) % n]

      // Face and more
      $('#visualization').appendChild(stringToElement(`
        <a-entity face-visualizer="v1: ${v1}; v2: ${v2}"></a-entity>
      `))

      // Spherical polyhedron by Gauss map (cf. discrete Gaussian curvature)
      const n1 = normals[i]
      const n2 = normals[(i + 1) % n]
      const m = normalize(cross(n2, n1)) // parallel to v2
      const el = stringToElement(`
        <a-entity circle-arc="phi: ${acos(dot(n1, n2))}; linewidth: 1.5"></a-entity>
      `)
      $('#visualization').appendChild(el)
      UtilsMisc.promiseLoaded(el).then(() =>
        el.object3D.applyMatrix4(T_frameXZ(n2, m)))
    }

    // Show sum of angles (turn)
    this.guiParams.angle = _.sum(angles) / (2 * PI)
    this.gui.updateDisplay()
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree(AFRAME)
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
