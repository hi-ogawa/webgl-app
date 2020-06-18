/* eslint camelcase: 0 */

//
// Discrete trivial connection with prescribed singularity
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
import * as ddg from '../utils/ddg.js'
import * as glm from '../utils/glm.js'
import { Matrix } from '../utils/array.js'

const THREE = AFRAME.THREE
const { $, stringToElement } = UtilsMisc

AFRAME.registerComponent('connection', {
  dependencies: ['geometry'],
  schema: {
    initFace: { default: 0, type: 'int' },
    initAngle: { default: 0 }
  },

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
    const nF = f2v.shape[0]

    // Vector field solver input
    const initFace = this.data.initFace
    const initAngle = this.data.initAngle
    const singularity = Matrix.empty([nV, 1])
    singularity.data[0] = 1 // north pole of icosphere
    singularity.data[11] = 1 // south pole

    // Solve
    const { vectorField, edges, normals } = ddg.solveVectorField(verts, f2v, singularity, initFace, initAngle)

    // Visualization
    const { addeq, add, muls, length, clone } = glm.vec3

    const centroids = ddg.computeFaceCentroids(verts, f2v)
    const nE = edges.shape[0]
    const edgeLengths = _.range(nE).map(i => length(edges.row(i)))
    const arrowLength = 0.35 * _.sum(edgeLengths) / nE

    // Draw vectors
    {
      const m1 = Matrix.empty([nF * 2, 3]) // position
      const m2 = Matrix.empty([nF * 2, 3]) // color

      for (let i = 0; i < nF; i++) {
        const v = vectorField.row(i)
        const p = clone(centroids.row(i))
        const n = normals.row(i)
        addeq(p, muls(n, arrowLength * 0.5)) // Push to the normal a bit

        m1.row(2 * i).set(p)
        m1.row(2 * i + 1).set(add(p, muls(v, arrowLength)))
        m2.row(2 * i).set([1, 0.5, 0])
        m2.row(2 * i + 1).set([0, 0.5, 1])
      }

      const geometry = new THREE.BufferGeometry()
      geometry.attributes.position = new THREE.BufferAttribute(m1.data, 3)
      geometry.attributes.color = new THREE.BufferAttribute(m2.data, 3)

      const material = new THREE.LineBasicMaterial({ linewidth: 2, vertexColors: true })
      const object = new THREE.LineSegments(geometry, material)
      this.el.setObject3D('vector-field', object)
    }

    // Mark vertex at singularity
    this.el.innerHTML = ''
    for (let i = 0; i < nV; i++) {
      const s = singularity.data[i]
      if (s === 0) { continue }

      const p = verts.row(i)
      this.el.appendChild(stringToElement(`
        <a-entity
          mixin="point"
          position="${p.join(' ')}"
        ></a-entity>
      `))
    }

    // Mark initial face
    {
      const p = centroids.row(initFace)
      this.el.appendChild(stringToElement(`
        <a-entity
          mixin="point"
          position="${p.join(' ')}"
          material="color: #fff"
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
