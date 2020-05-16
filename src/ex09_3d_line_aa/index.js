/* eslint camelcase: 0, no-eval: 0 */
/* global fetch */

//
// 3d Line AA manually
//

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import { OrbitControls } from '../../web_modules/three/examples/jsm/controls/OrbitControls.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { AppBase, runApp } from '../utils/app.js'

/* eslint-disable no-unused-vars */
const { PI, cos, sin } = Math
const {
  vec2, vec3, vec4, mat3,
  M_add, M_mul,
  pow2
} = Utils
/* eslint-enable no-unused-vars */

class App extends AppBase {
  constructor () {
    super(...arguments)
    this.camera = new THREE.PerspectiveCamera()
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.uniforms = {
      U_resolution: { value: vec2(0) },
      U_line_width: { value: 1.5 },
      U_aa_width: { value: 1.5 }
    }
    this.params = {
      line_width: this.uniforms.U_line_width.value,
      aa_width: this.uniforms.U_aa_width.value,
      context: 'const [p, q, r0, r1] = [2, 3, 2, 1]',
      samples: '[0, 2 * PI, 256]',
      fx: 'cos(q * t) * (r0 + r1 * cos(p * t))',
      fy: 'sin(q * t) * (r0 + r1 * cos(p * t))',
      fz: 'r1 * sin(p * t)'
    }
    this.params_needsUpdate = false
  }

  updateSize () {
    super.updateSize()
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  makeCurve () {
    const { context, samples, fx, fy, fz } = this.params
    const ts = eval(samples)
    const f = eval(`(t) => { ${context}; return [${fx}, ${fy}, ${fz}] }`)
    const position = Utils.linspace(...ts).map(f)
    this.$('graph').geometry.dispose()

    const g = Utils.makeBufferGeometry(UtilsMisc.makeLineAA(position))
    this.$('graph').geometry = g
  }

  async init () {
    await super.init()

    // Camera
    _.assign(this.camera, { fov: 39, near: 1e-2, far: 1e2 })
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(M_mul(4, vec3(1, 1, 2)))
    this.controls.update()

    // Gui
    _.keys(this.params).forEach(key => {
      this.gui.add(this.params, key).onFinishChange(
        () => { this.params_needsUpdate = true })
    })

    // Fetch glsl
    const index_glsl = await (await fetch('./index.glsl')).text()

    // Axes
    {
      const { position, color } = UtilsMisc.makeAxes([0, 1, 2], 10)
      const g = Utils.makeBufferGeometry(
        UtilsMisc.makeLineSegmentsAA(position, color))
      const m = Utils.makeShaderMaterial(index_glsl, { Main00: true })
      m.uniforms = _.assign({
        U_use_vertexColors: { value: true }
      }, this.uniforms)
      m.transparent = true
      m.depthWrite = false // Remove intersection outline due to conflicting depth
      const object = new THREE.Mesh(g, m)
      object.frustumCulled = false
      object.renderOrder = -1
      this.scene.add(object)
    }

    // Grid
    {
      const position = UtilsMisc.makeGrid(1, 10)
      const g = Utils.makeBufferGeometry(
        UtilsMisc.makeLineSegmentsAA(position))
      const m = Utils.makeShaderMaterial(index_glsl, { Main00: true })
      m.uniforms = _.assign({
        U_use_vertexColors: { value: false },
        U_color: { value: vec3(0.3) }
      }, this.uniforms)
      m.transparent = true
      m.depthWrite = false
      const object = new THREE.Mesh(g, m)
      object.frustumCulled = false
      object.renderOrder = -2 // "Axis" will overwrite "Grid"
      this.scene.add(object)
    }

    // Parametric curve
    {
      const m = Utils.makeShaderMaterial(index_glsl, { Main00: true })
      m.uniforms = _.assign({
        U_use_vertexColors: { value: true },
        U_color: { value: vec3(1.0) }
      }, this.uniforms)
      m.transparent = true

      const g = new THREE.BufferGeometry()
      const object = new THREE.Mesh(g, m)

      // const object = new THREE.Line(
      //   new THREE.BufferGeometry(), new THREE.LineBasicMaterial())
      object.name = 'graph'
      this.scene.add(object)
      this.makeCurve()
    }

    // Origin point
    {
      const geometry = Utils.makeBufferGeometry({
        position: [[0, 0, 0], [0, 0, 0]],
        color: [[1, 1, 1], [1, 1, 0]]
      })
      const diskAlphaMap = UtilsMisc.makeDiskAlphaMap(3.5, 2) // radius, aa
      const material = new THREE.PointsMaterial({
        size: diskAlphaMap.image.width,
        sizeAttenuation: false,
        alphaMap: diskAlphaMap,
        transparent: true,
        vertexColors: true
      })
      const object = new THREE.Points(geometry, material)
      object.name = 'points'
      this.scene.add(object)
    }
  }

  update () {
    super.update()
    this.camera.updateMatrix()
    this.uniforms.U_resolution.value = vec2(this.width, this.height)
    this.uniforms.U_line_width.value = this.params.line_width
    this.uniforms.U_aa_width.value = this.params.aa_width
    if (this.params_needsUpdate) {
      this.makeCurve()
      this.params_needsUpdate = false
    }
  }
}

const main = () => runApp(
  App, document.querySelector('#root'),
  'webgl2', { antialias: false })

export { main }
