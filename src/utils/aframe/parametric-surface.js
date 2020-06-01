/* eslint camelcase: 0, no-eval: 0 */

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

AFRAME.registerGeometry('parametric-surface', {
  schema: {
    x0: { default: -1 },
    x1: { default: 1 },
    y0: { default: -1 },
    y1: { default: 1 },
    segmentsX: { default: 1, min: 1, type: 'int' },
    segmentsY: { default: 1, min: 1, type: 'int' },
    periodicX: { default: false },
    periodicY: { default: false },
    f: { default: '(x, y) => [x, y, 0]', type: 'string' },
    preset: {
      default: '',
      type: 'string',
      oneOf: [
        'plane', 'saddle', 'torus', 'sphere',
        'ellipsoid', 'hyperboloid1', 'hyperboloid2'
      ]
    }
  },

  presets: {
    plane: {
      x0: -1,
      x1: 1,
      y0: -1,
      y1: 1,
      segmentsX: 1,
      segmentsY: 1,
      periodicX: false,
      periodicY: false,
      f: '(x, y) => [x, y, 0]'
    },
    saddle: {
      x0: -1,
      x1: 1,
      y0: -1,
      y1: 1,
      segmentsX: 32,
      segmentsY: 32,
      periodicX: false,
      periodicY: false,
      f: '(x, y) => [x, y, x*x - y*y]'
    },
    torus: {
      x0: 0,
      x1: 2 * PI,
      y0: 0,
      y1: 2 * PI,
      segmentsX: 64,
      segmentsY: 32,
      periodicX: true,
      periodicY: true,
      f: `
        (u, v) => {
          const r0 = 1
          const r1 = 0.5
          const y = r1 * cos(v) + r0
          const z = r1 * sin(v)
          return [- sin(u) * y, cos(u) * y, z]
        }
      `
    },
    sphere: {
      x0: 0,
      x1: 2 * PI,
      y0: 0,
      y1: PI,
      segmentsX: 64,
      segmentsY: 32,
      periodicX: false,
      periodicY: false,
      f: `
        (u, v) => {
          return [
            sin(v) * cos(u),
            sin(v) * sin(u),
            cos(v)
          ]
        }
      `
    },
    ellipsoid: {
      x0: 0,
      x1: 2 * PI,
      y0: 0,
      y1: PI,
      segmentsX: 64,
      segmentsY: 32,
      periodicX: true,
      periodicY: false,
      f: `
        (u, v) => {
          const [r0, r1, r2] = [0.5, 1, 1.5]
          return [
            r0 * sin(v) * r1 * cos(u),
            r0 * sin(v) * r2 * sin(u),
            r0 * cos(v)
          ]
        }
      `
    },
    hyperboloid1: {
      x0: 0,
      x1: 2 * PI,
      y0: -1,
      y1: 1,
      segmentsX: 64,
      segmentsY: 32,
      periodicX: true,
      periodicY: false,
      f: `
        (u, v) => {
          return [
            cosh(v) * cos(u),
            cosh(v) * sin(u),
            sinh(v),
          ]
        }
      `
    },
    hyperboloid2: {
      x0: -1,
      x1: 1,
      y0: -1,
      y1: 1,
      segmentsX: 32,
      segmentsY: 32,
      periodicX: false,
      periodicY: false,
      f: `
        (u, v) => {
          return [u, v, sqrt(1 + u*u + v*v) - 1]
        }
      `
    }
  },

  init (data) {
    if (data.preset in this.presets) {
      _.assign(data, this.presets[data.preset], { preset: data.preset })
    }

    const {
      f, x0, x1, y0, y1,
      segmentsX: n,
      segmentsY: m,
      periodicX, periodicY
    } = data

    // xy (used for `curvature-visualizer`)
    const xx = Utils.linspace(x0, x1, n)
    const yy = Utils.linspace(y0, y1, m)
    if (periodicX) { xx.pop() }
    if (periodicY) { yy.pop() }
    const xy = yy.map(y => xx.map(x => [x, y])).flat()

    // position
    const f_eval = eval(f)
    const position = xy.map(([x, y]) => f_eval(x, y))

    // index
    const index = []
    const nn = periodicX ? n : n + 1
    const mm = periodicY ? m : m + 1
    for (const x of _.range(n)) {
      for (const y of _.range(m)) {
        const quad = [
          nn * ((y + 0) % mm) + ((x + 0) % nn),
          nn * ((y + 0) % mm) + ((x + 1) % nn),
          nn * ((y + 1) % mm) + ((x + 1) % nn),
          nn * ((y + 1) % mm) + ((x + 0) % nn)
        ]
        index.push(...UtilsMisc.quadToTriIndex(quad))
      }
    }

    this.geometry = Utils.makeBufferGeometry({ xy, position, index })
    this.geometry.computeVertexNormals()
    data.buffer = false // cf. toBufferGeometry in aframe/src/systems/geometry.js
  }
})
