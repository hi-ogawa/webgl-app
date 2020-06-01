/* eslint camelcase: 0, no-eval: 0 */

//
// Osculating circle of principal normal curvature
// (Mouse over on surface with pressing "Alt")
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/coordinate-grid.js'
import '../utils/aframe/parametric-surface.js'

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
/* eslint-enable no-unused-vars */

AFRAME.registerComponent('mouse-raycaster', {
  schema: {
    drawPoint: { default: true }
  },

  init () {
    this.intersections = []

    const point = UtilsMisc.makeDiskPoints([[0, 0, 0]], [[1, 1, 0]])

    // It's silly but need to convert from THREE to AFRAME.THREE
    this.object = new AFRAME.THREE.Points(point.geometry, point.material)
    _.assign(this.object, {
      visible: false,
      frustumCulled: false
    })

    this.el.sceneEl.object3D.add(this.object)
  },

  remove () {
    this.el.sceneEl.object3D.remove(this.object)
  },

  tick () {
    const { mouse, keys } = this.el.sceneEl.systems.input.state
    if (!keys.Alt) { return }

    const { clientWidth: w, clientHeight: h } = this.el.sceneEl.canvas
    const { camera } = this.el.sceneEl
    const { mesh } = this.el.object3DMap

    const windowToRay = UtilsMisc.makeWindowToRay(w, h, camera)
    const ray_o = vec3(M_get(camera.matrixWorld, 3))
    const ray_d = normalize(vec3(M_mul(windowToRay, vec4(mouse, 0, 1))))
    const raycaster = new THREE.Raycaster(ray_o, ray_d)

    // Reset state
    this.intersections = []
    this.object.visible = false
    if (!mesh) { return }

    // Intersect
    this.intersections = raycaster.intersectObject(mesh)
    if (this.intersections.length === 0) { return }

    const { point } = this.intersections[0]
    this.object.position.copy(point)

    if (this.data.drawPoint) {
      this.object.visible = true
    }
  }
})

AFRAME.registerComponent('curvature-visualizer', {
  dependencies: ['geometry', 'mouse-raycaster'],

  init () {
    this.tangent = new THREE.Group()

    const frame = UtilsMisc.makeFrame()
    frame.name = 'frame'
    frame.scale.copy(vec3(0.4))

    const disk1 = new THREE.Mesh(
      UtilsMisc.makeDisk(64),
      new THREE.MeshStandardMaterial({
        color: '#ff0',
        roughness: 0.5,
        opacity: 0.9,
        transparent: true,
        side: THREE.DoubleSide
      })
    )
    disk1.geometry.applyMatrix4(T_translate(vec3(0, 1, 0)))
    disk1.name = 'disk1'

    const disk2 = new THREE.Mesh(
      UtilsMisc.makeDisk(64),
      new THREE.MeshStandardMaterial({
        color: '#0ff',
        roughness: 0.5,
        opacity: 0.9,
        transparent: true,
        side: THREE.DoubleSide
      })
    )
    disk2.geometry.applyMatrix4(T_translate(vec3(0, 1, 0)))
    disk2.geometry.applyMatrix4(mat4(T_axisAngle(vec3(0, 1, 0), -0.5 * PI)))
    disk2.name = 'disk2'

    this.tangent.add(frame, disk1, disk2)
    this.tangent.visible = false
    this.el.object3D.add(this.tangent)
  },

  remove () {
    this.el.object3D.remove(this.tangent)
  },

  tick () {
    const isects = this.el.components['mouse-raycaster'].intersections
    if (isects.length === 0) { return }

    const { point, faceIndex, object } = isects[0]
    const { matrixWorld, geometry } = object
    const p = vec3(M_mul(inverse(matrixWorld), vec4(point, 1)))

    // Linear interpolate intersection on triangle
    // NOTE: this fails on periodic parametric surface (e.g. torus)
    let xy, uv
    {
      const i012 = UtilsMisc.getAttributeElement(geometry, 'index', faceIndex)
      const p012 = i012.map(i =>
        vec3(...UtilsMisc.getAttributeElement(geometry, 'position', i)))
      const xy012 = i012.map(i =>
        vec2(...UtilsMisc.getAttributeElement(geometry, 'xy', i)))

      const q1 = M_sub(p012[1], p012[0])
      const q2 = M_sub(p012[2], p012[0])
      const q = M_sub(p, p012[0])

      // Barycentric coordinates
      //   q = [q1, q2] * uv = A * uv
      //   <=> A^T * q = A^T * A * uv
      //   <=> (A^T * A)^-1 * A^T * q = uv
      const AT_A = mat2(
        dot(q1, q1), dot(q1, q2), dot(q1, q2), dot(q2, q2))
      const AT_q = vec2(dot(q1, q), dot(q2, q))
      uv = M_mul(inverse(AT_A), AT_q)

      const vv1 = M_sub(xy012[1], xy012[0])
      const vv2 = M_sub(xy012[2], xy012[0])
      xy = [xy012[0], M_mul(vv1, uv.x), M_mul(vv2, uv.y)].reduce(M_add)
    }

    const { f: f_string } = this.el.components.geometry.data
    const f_eval = eval(f_string)
    const F = (v) => vec3(...f_eval(...v))
    const h = 1e-4

    // derivative by finite difference
    const F0 = F(xy)
    const F1 = F(M_add(xy, vec2(+h, 0)))
    const F2 = F(M_add(xy, vec2(-h, 0)))
    const F3 = F(M_add(xy, vec2(0, +h)))
    const F4 = F(M_add(xy, vec2(0, -h)))
    const F5 = F(M_add(xy, vec2(+h, +h)))
    const F6 = F(M_add(xy, vec2(+h, -h)))
    const F7 = F(M_add(xy, vec2(-h, +h)))
    const F8 = F(M_add(xy, vec2(-h, -h)))

    const dF0 = M_div(M_sub(F1, F2), 2 * h)
    const dF1 = M_div(M_sub(F3, F4), 2 * h)

    const ddF0 = M_div(M_sub(M_add(F1, F2), M_mul(2, F0)), h * h)
    const ddF1 = M_div(M_sub(M_add(F3, F4), M_mul(2, F0)), h * h)
    const ddF2 = M_div(M_sub(M_sub(F5, F6), M_sub(F7, F8)), 4 * h * h)

    // curvature via shape operator
    // cf. https://hi-ogawa.github.io/markdown-tex/?id=e40372524f96337f1f2066ad332b4d2b&filename=curvature-01-surface
    const g = mat2(
      dot(dF0, dF0), dot(dF0, dF1),
      dot(dF0, dF1), dot(dF1, dF1))
    const N = normalize(cross(dF0, dF1))
    const A = mat2(
      dot(N, ddF0), dot(N, ddF2),
      dot(N, ddF2), dot(N, ddF1))
    const S = M_mul(inverse(g), A)

    // TODO: support k1 == k2 (i.e. sphere)
    const [[k1, k2], [v1, v2]] = eigen_mat2(S) // eslint-disable-line

    // force v1 to be in "right quadrants"
    if (v1.x <= 0) {
      v1.copy(M_mul(-1, v1))
    }

    // mean/gaussian curture
    // const kM = (k1 + k2) / 2
    // const kG = k1 * k2

    const DF = mat3(dF0, dF1, vec3(0))
    const u1 = normalize([DF, vec3(v1, 0)].reduce(M_mul))

    // Draw osculating circles of principal normal curvature
    // - update frame
    this.tangent.position.copy(p)
    this.tangent.setRotationFromMatrix(mat4(mat3(u1, N, cross(u1, N))))
    // - update osculating circle
    this.tangent.getObjectByName('disk1').scale.copy(vec3(1 / k1))
    this.tangent.getObjectByName('disk2').scale.copy(vec3(1 / k2))
    this.tangent.visible = true
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree(AFRAME)
  const $ = (...args) => document.querySelector(...args)
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
