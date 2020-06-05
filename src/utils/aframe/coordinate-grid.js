/* eslint camelcase: 0 */

import _ from '../../../web_modules/lodash.js'
import AFRAME from '../../../web_modules/aframe.js'
import * as Utils from '../index.js'
import * as UtilsMisc from '../misc.js'

/* eslint-disable no-unused-vars */
const THREE = AFRAME.THREE
const { PI, cos, sin, pow, sqrt, cosh, sinh } = Math
const {
  vec2, vec3, vec4, mat2, mat3, mat4,
  M_add, M_sub, M_mul, M_div, M_get,
  T_translate, T_axisAngle,
  dot, inverse, cross, normalize, transpose,
  diag, pow2, smoothstep01, dot2, outer, outer2,
  eigen_mat2, sqrt_mat2,
  toColor
} = Utils
const {
  makeWindowToCamera, makeWindowToRay
} = UtilsMisc
/* eslint-enable no-unused-vars */

// NOTE: Line primitive cannot be registered as geometry
AFRAME.registerComponent('coordinate-grid', {
  schema: {
    x: { default: true },
    y: { default: true },
    z: { default: true },
    xy: { default: false },
    yz: { default: false },
    zx: { default: true },
    size: { default: 10, type: 'int' },
    colorAxes: { default: true }
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

  remove () {
    this.el.removeObject3D(this.attrName)
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
        vertexColors: this.data.colorAxes,
        color: this.data.colorAxes ? '#fff' : '#444'
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
  }
})
