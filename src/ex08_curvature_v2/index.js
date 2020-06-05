/* eslint camelcase: 0, no-eval: 0 */

//
// Osculating circle of 3d curve (fx(t), fy(t), fz(t))
//

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import { OrbitControls } from '../../web_modules/three/examples/jsm/controls/OrbitControls.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { AppBase, runApp } from '../utils/app.js'
import { patchAframeThree } from '../utils/aframe/misc.js'

/* eslint-disable no-unused-vars */
const { PI, cos, sin, pow } = Math
const {
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_sub, M_mul, M_div,
  T_translate, T_axisAngle, M_diag,
  pow2, dot, dot2, outer, outer2, cross, normalize,
  toColor
} = Utils
Utils.patchThreeMath()
/* eslint-enable no-unused-vars */

class App extends AppBase {
  constructor () {
    super(...arguments)
    this.camera = new THREE.PerspectiveCamera()
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.params = {
      context: 'const [p, q, r0, r1] = [3, 2, 2, 1]',
      samples: '[0, 2 * PI, 256]',
      fx: 'cos(q * t) * (r0 + r1 * cos(p * t))',
      fy: 'sin(q * t) * (r0 + r1 * cos(p * t))',
      fz: 'r1 * sin(p * t)',
      animate: true,
      animate_speed: 0.5
    }
    this.params_needsUpdate = false
  }

  updateSize () {
    super.updateSize()
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  evalCurveParams () {
    const { context, samples, fx, fy, fz } = this.params
    const [t0, t1, num] = eval(samples)
    const f = eval(`(t) => { ${context}; return [${fx}, ${fy}, ${fz}] }`)
    return [f, t0, t1, num]
  }

  makeCurve () {
    const [f, t0, t1, num] = this.evalCurveParams()
    const position = Utils.linspace(t0, t1, num).map(f)
    this.$('curve').geometry.dispose()
    this.$('curve').geometry = Utils.makeBufferGeometry({ position })
  }

  async init () {
    await super.init()

    // Camera
    _.assign(this.camera, { fov: 39, near: 1e-2, far: 1e2 })
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(M_mul(4, vec3(1, 1, 2)))
    this.controls.update()

    // Gui
    for (const key of _.keys(this.params)) {
      this.gui.add(this.params, key).onFinishChange(
        () => { this.params_needsUpdate = true })
    }

    // Axes
    {
      const g = Utils.makeBufferGeometry(
        UtilsMisc.makeAxes([0, 1, 2], 10))
      const m = new THREE.LineBasicMaterial({
        linewidth: 2,
        vertexColors: true
      })
      const object = new THREE.LineSegments(g, m)
      object.frustumCulled = false
      this.scene.add(object)
    }

    // Grid
    {
      const g = Utils.makeBufferGeometry({
        position: UtilsMisc.makeGrid(1, 10)
      })
      const m = new THREE.LineBasicMaterial({
        linewidth: 1.5,
        color: 0x444444
      })
      const object = new THREE.LineSegments(g, m)
      object.frustumCulled = false
      this.scene.add(object)
    }

    // Parametric curve
    {
      const g = new THREE.BufferGeometry()
      const m = new THREE.LineBasicMaterial({
        linewidth: 2.0
      })
      const object = new THREE.Line(g, m)
      object.name = 'curve'
      this.scene.add(object)
      this.makeCurve()
    }

    // osculating circle
    {
      const n = 64
      const circle = Utils.linspace(0, 2 * PI, n).map(x => [cos(x), sin(x), 0])
      const position = circle.concat([[0, 0, 0]])
      const g1 = Utils.makeBufferGeometry({
        position: position,
        normal: Array(position.length).fill([0, 0, 1]),
        index: _.range(n).map(i => [i, (i + 1) % n, n])
      })
      const m1 = new THREE.MeshStandardMaterial({
        roughness: 0.3, opacity: 0.9, transparent: true
      })

      // Different shading on front/back
      const g2 = g1.clone()
      const m2 = m1.clone()
      g1.applyMatrix4(T_translate(vec3(0, 0, +0.001)))
      g2.applyMatrix4(M_mul(M_diag(vec4(-1, 1, -1, 1)), T_translate(vec3(0, 0, -0.001))))
      m1.color = toColor(vec3(1.0, 0.8, 0.6))
      m2.color = toColor(vec3(0.6, 0.8, 1.0))

      // center and tangent point
      const o3 = UtilsMisc.makeDiskPoints(
        [[0, 0, 0], [0, -1, 0]], [[0, 1, 1], [1, 1, 0]])
      o3.renderOrder = 1

      // line segment of points
      const g4 = Utils.makeBufferGeometry({ position: [[0, 0, 0], [0, -1, 0]] })
      const m4 = new THREE.LineBasicMaterial({ color: 0xffffcc, linewidth: 1 })

      // frame arrows at tangent point
      const o5 = UtilsMisc.makeFrame()
      o5.position.copy(vec3(0, -1, 0))
      o5.name = 'circle (frame)'

      const object = new THREE.Scene()
      object.add(new THREE.Mesh(g1, m1))
      object.add(new THREE.Mesh(g2, m2))
      object.add(o3)
      object.add(new THREE.Line(g4, m4))
      object.add(o5)

      object.name = 'circle'
      this.scene.add(object)
    }

    // Lighting
    {
      // sun from camera
      const o1 = new THREE.DirectionalLight(toColor(vec3(0.6)))
      const o2 = new THREE.AmbientLight(toColor(vec3(0.2)))
      o1.name = 'sun'
      this.scene.add(o1)
      this.scene.add(o2)
    }

    // Initially use point for t = t0
    this.updateOsculatingCircle(0)
  }

  updateOsculatingCircle (t) {
    const [f] = this.evalCurveParams()

    // Derivative by finite differene
    const F = (t) => vec3(...f(t))
    const Ft = F(t)
    const dt = 1e-3
    const FtP = F(t + dt)
    const FtN = F(t - dt)
    const dF = M_div(M_sub(FtP, FtN), 2 * dt)
    const ddF = M_div(M_sub(M_add(FtP, FtN), M_mul(2, Ft)), dt * dt)

    // Find osculating circle parameter (G is arc-length parametrized curve)
    // cf. https://hi-ogawa.github.io/markdown-tex/?id=e40372524f96337f1f2066ad332b4d2b&filename=curvature
    const ddG = M_mul(-1 / pow(dF.length(), 4), cross(dF, cross(dF, ddF)))
    const k = ddG.length()
    const u = M_div(ddG, k)
    const radius = 1 / k
    const center = M_add(M_mul(radius, u), Ft)
    const frame = mat3(normalize(dF), u, normalize(cross(dF, u)))

    // Drawing
    this.$('circle').position.copy(vec3(center, 0))
    this.$('circle').scale.copy(vec3(radius))
    this.$('circle').setRotationFromMatrix(mat4(frame))
    this.$('circle (frame)').scale.copy(vec3(1 / radius)) // keep scale of "frame"
  }

  updateOsculatingCircleByIntersection (isect) {
    const { point: p, index: i } = isect
    const [_f, t0, t1, num] = this.evalCurveParams() // eslint-disable-line

    const getXYZ = (attr, i) =>
      vec3(...attr.array.slice(3 * i, 3 * (i + 1)))

    // Find t s.t. f(t) ~ p
    const attr = this.$('curve').geometry.attributes.position
    const p0 = getXYZ(attr, i)
    const p1 = getXYZ(attr, i + 1)
    const s = M_sub(p, p0).length() / M_sub(p1, p0).length()
    const t = t0 + (t1 - t0) * ((i + s) / num)
    this.updateOsculatingCircle(t)
  }

  updateOsculatingCircleByRaycast (mouse) {
    const raycaster = new THREE.Raycaster(
      this.camera.position,
      normalize(M_sub(this.windowToWorld(mouse), this.camera.position)))
    raycaster.params.Line.threshold = 0.2

    const isects = raycaster.intersectObject(this.$('curve'))
    if (isects.length > 0) {
      // Sort by (ray, point) distance instead of
      // default (ray, infinite line) distance
      const ds = isects.map(isect =>
        raycaster.ray.distanceToPoint(isect.point))
      const isects_ds = _.zip(isects, ds)
      isects_ds.sort(([_1, d1], [_2, d2]) => d1 - d2) // eslint-disable-line
      const [isect, d] = isects_ds[0] // eslint-disable-line
      this.updateOsculatingCircleByIntersection(isect)
    }
  }

  update () {
    super.update()
    this.camera.updateMatrix()

    if (this.params_needsUpdate) {
      this.makeCurve()
      this.params_needsUpdate = false
    }

    // Input handling
    {
      const { mouse, keys } = this.input

      // Disable camera control during "Alt" is pressed
      this.controls.enabled = !keys.Alt

      if (keys.Alt && mouse.x >= 0 && !this.params.animate) {
        this.updateOsculatingCircleByRaycast(mouse)
      }
    }

    // Sun light from camera
    this.$('sun').position.copy(this.camera.position)

    // Animate
    if (this.params.animate) {
      this.updateOsculatingCircle(this.params.animate_speed * this.time / 1000)
    }
  }
}

const main = () => {
  patchAframeThree()
  runApp(App, document.querySelector('#root'))
}

export { main }
