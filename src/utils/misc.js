/* eslint camelcase: 0 */

import _ from '../../web_modules/lodash.js'
import * as THREE from '../../web_modules/three/build/three.module.js'
import * as Utils from './index.js'

const {
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_mul, M_diag, M_inverse,
  T_translate, smoothstep01
} = Utils

class Camera2dHelper {
  constructor (camera) {
    this.camera = camera
    this.camera_zoom = 0 // = log_2(scale) so it's additive
    this.fov_height = 4
    this.width = 0
    this.height = 0
    this.aspect = 0
    this.window_to_camera = mat4(1)
    this.window_to_world = mat4(1)
  }

  windowToWorld (xy) {
    return vec2(M_mul(this.window_to_world, vec4(xy, 0, 1)))
  }

  move (dxy) {
    this.camera.position.add(vec3(vec2(
      M_mul(mat3(this.window_to_camera), vec3(dxy, 0)))))
    this.updateMatrix()
  }

  zoom (xy, deltaZoom) {
    // Preserve `xy`
    // <=> camera' + to_camera' * xy = camera + to_camera * xy
    // <=> camera' = camera + (to_camera - to_camera') * xy
    //             = camera + (1 - 2^delta) * to_camera * xy
    const deltaCamera = [
      1 - Math.pow(2.0, deltaZoom),
      this.window_to_camera,
      vec4(xy, 0, 1)
    ].reduce(M_mul)
    this.camera.position.add(vec3(deltaCamera))
    this.camera_zoom += deltaZoom
    this.updateMatrix()
  }

  updateMatrix () {
    this.camera.updateMatrix()

    this.camera.projectionMatrix = Utils.T_orthographic(
      Utils.yfovFromHeight(Math.pow(2, this.camera_zoom) * this.fov_height),
      this.aspect, 0, 1e4)

    this.window_to_camera = [
      M_diag(vec4(1, 1, 0, 1)), // to z = 0
      M_inverse(this.camera.projectionMatrix), // inverse projection
      T_translate(vec3(-1, -1, 0)), // window to ndc (translate)
      M_diag(vec4(2 / this.width, 2 / this.height, 0, 1)) // window to ndc (scale)
    ].reduce(M_mul)

    this.window_to_world = [
      M_diag(vec4(1, 1, 0, 1)), // to z = 0
      this.camera.matrix,
      T_translate(vec3(0, 0, -1)), // to z = -1
      this.window_to_camera
    ].reduce(M_mul)
  }
}

const makeDiskAlphaMap = (radius, aa) => {
  // cf. Main01 in ex05_camera_2d/index.glsl
  const w = 2 * radius + 1 + aa
  const h = 2 * radius + 1 + aa
  const center = vec2(w / 2, h / 2)
  const data = _.range(h).map(i => _.range(w).map(j => {
    const coord = M_add(0.5, vec2(j, i))
    const sd = M_add(coord, M_mul(-1, center)).length() - radius
    const fac = 1.0 - smoothstep01(sd / aa + 0.5)
    return [0, fac * 255, 0]
  }))
  const array = new Uint8Array(_.flattenDeep(data))
  const tex = new THREE.DataTexture(array, w, h, THREE.RGBFormat)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

export { Camera2dHelper, makeDiskAlphaMap }
