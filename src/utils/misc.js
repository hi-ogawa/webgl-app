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

const makeGrid = (axis, size) => {
  const position = []
  const jj = (axis + 1) % 3;
  const kk = (axis + 2) % 3;
  for (const [j, k] of [[jj, kk], [kk, jj]]) {
    for (const l of _.range(-size, size + 1)) {
      if (l === 0) { continue; }
      const [p1, p2] = [[0, 0, 0], [0, 0, 0]]
      p1[j] = p2[j] = l
      p1[k] = +size
      p2[k] = -size
      position.push(p1, p2)
    }
  }
  return position
}

const makeAxis = (axis, size) => {
  const [p1, p2, c] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  p1[axis] = +size
  p2[axis] = -size
  c[axis] = 1
  return [[p1, p2], [c, c]]
}

const makeAxes = (axes, size) => {
  const result = { position: [], color: [] }
  for (const axis of axes) {
    const [pp, cc] = makeAxis(axis, size)
    result.position.push(...pp)
    result.color.push(...cc)
  }
  return result
}

const quadToTriIndex = ([a, b, c, d]) => [[a, b, c], [a, c, d]]

const makeLineSegmentsAA = (position, color) => {
  // Make input for "manual geometry shader" (cf. ex09_3d_line_aa)
  const num_lines = position.length / 2
  const index =_.chunk(_.range(4 * num_lines), 4).map(quadToTriIndex)

  const p1 = []
  const p2 = []
  const cc = []
  for (const i of _.range(num_lines)) {
    p1.push(...Array(4).fill(position[2 * i + 0]))
    p2.push(...Array(4).fill(position[2 * i + 1]))

    if (color) {
      const c1 = color[2 * i + 0]
      const c2 = color[2 * i + 1]
      cc.push(c1, c2, c2, c1)
    }
  }

  const result = {
    position1: p1,
    position2: p2,
    index: _.flattenDeep(index)
  }

  if (color) { result.color = cc }
  return result;
}

const makeLineAA = (position, color) => {
  const num_lines = position.length - 1
  const index =_.chunk(_.range(4 * num_lines), 4).map(quadToTriIndex)

  const p1 = []
  const p2 = []
  const cc = []
  for (const i of _.range(num_lines)) {
    p1.push(...Array(4).fill(position[i + 0]))
    p2.push(...Array(4).fill(position[i + 1]))

    if (color) {
      const c1 = color[i + 0]
      const c2 = color[i + 1]
      cc.push(c1, c2, c2, c1)
    }
  }

  const result = {
    position1: p1,
    position2: p2,
    index: _.flattenDeep(index)
  }

  if (color) { result.color = cc }
  return result;
}

export {
  Camera2dHelper,
  makeDiskAlphaMap, makeGrid, makeAxes, quadToTriIndex,
  makeLineSegmentsAA, makeLineAA
}
