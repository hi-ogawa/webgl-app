/* eslint camelcase: 0 */

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from './index.js'

const THREE = AFRAME.THREE

/* eslint-disable no-unused-vars */
const { PI, cos, sin, pow, sign } = Math
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

class Camera2dHelper {
  constructor (camera) {
    this.camera = camera
    this.camera_zoom = 0 // = log_2(scale) so it's additive
    this.fov_height = 4
    this.width = 0
    this.height = 0
    this.aspect = 0
    this.window_to_camera = mat4(1)
  }

  move (dxy) {
    this.camera.position.add(vec3(
      M_mul(mat3(this.window_to_camera), vec3(dxy, 0))))
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
      diag(vec4(1, 1, 0, 1)), // to z = 0
      inverse(this.camera.projectionMatrix), // inverse projection
      T_translate(vec3(-1, -1, 0)), // window to ndc (translate)
      diag(vec4(2 / this.width, 2 / this.height, 0, 1)) // window to ndc (scale)
    ].reduce(M_mul)
  }
}

// TODO:
// when using this (instead of usual OrbitControls), screenshot.js fails to render lines.
// probably, it's because some necessarily matrix update is skipped?
class Camera3dHelper {
  constructor (camera) {
    // NOTE: actually `camera` doesn't have to be `Camera` class
    this.camera = camera
    this.camera.matrixAutoUpdate = false
    this.lookat = vec3(0)
  }

  init () {
    const up = vec3(0, 1, 0)
    const camera_p = this.camera.position
    const z = normalize(M_sub(camera_p, this.lookat))
    const x = normalize(cross(up, z))
    const y = cross(z, x)
    this.camera.matrix = M_mul(T_translate(camera_p), mat4(mat3(x, y, z)))
    this.update()
  }

  move (dxy) {
    // Project `dxy` to plane of "z = lookat.z"
    dxy = M_mul(dxy, M_sub(this.camera.position, this.lookat).length())
    this.lookat = M_add(
      this.lookat, M_mul(mat3(this.camera.matrix), vec3(dxy)))
    this.camera.matrix = M_mul(
      this.camera.matrix, T_translate(vec3(dxy, 0)))
    this.update()
  }

  zoom (delta) {
    const l = M_sub(this.camera.position, this.lookat).length()
    const dl = (1 - pow(2, -delta)) * l
    this.camera.matrix = M_mul(
      this.camera.matrix, T_translate(vec3(0, 0, -dl)))
    this.update()
  }

  orbit (dxy) {
    const XX = M_get(mat3(this.camera.matrix), 0)
    const YY = M_get(mat3(this.camera.matrix), 1)

    // when camera is upside-down, we flip "horizontal" orbit direction (as in Blender).
    const flip = sign(dot(YY, vec3(0.0, 1.0, 0.0)))

    // vertical/horizontal orbit
    const orbit_v = T_axisAngle(XX, dxy.y)
    const orbit_h = T_axisAngle(vec3(0, 1, 0), flip * dxy.x)
    const orbit = M_mul(orbit_h, orbit_v)

    // "lookat" frame
    const toLookat = T_translate(M_mul(-1, this.lookat))
    const fromLookat = T_translate(this.lookat)

    this.camera.matrix = [
      fromLookat, mat4(orbit), toLookat, this.camera.matrix
    ].reduce(M_mul)

    this.update()
  }

  update () {
    this.camera.applyMatrix4(mat4(1)) // trigger `decompose`
    this.camera.updateMatrixWorld(true)
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

const makeDiskPoints = (positions, colors, radius, aa_width) => {
  const geometry = Utils.makeBufferGeometry({
    position: positions,
    color: colors
  })
  const diskAlphaMap = makeDiskAlphaMap(radius || 3.5, aa_width || 2)
  const material = new THREE.PointsMaterial({
    size: diskAlphaMap.image.width,
    sizeAttenuation: false,
    alphaMap: diskAlphaMap,
    transparent: true,
    depthTest: false,
    vertexColors: true
  })
  const object = new THREE.Points(geometry, material)
  return object
}

const makeFrame = () => {
  const gArrow = new THREE.CylinderBufferGeometry(0, 0.05, 0.2, 12, 1)
  const gLine = Utils.makeBufferGeometry({ position: [[0, 1, 0], [0, 0, 0]] })
  const m = new THREE.MeshBasicMaterial()
  const object = new THREE.Scene()

  const patterns = [
    [0xff0000, vec3(0, 0, 1), -0.5 * PI],
    [0x00ff00, vec3(0, 0, 1), 0],
    [0x0000ff, vec3(1, 0, 0), 0.5 * PI]
  ]

  for (const [color, axis, angle] of patterns) {
    const mm = m.clone()
    mm.color.set(color)

    const o1 = new THREE.Mesh(gArrow, mm)
    o1.position.copy(vec3(0, 1, 0))

    const o2 = new THREE.Line(gLine, mm)

    const o = new THREE.Scene()
    o.add(o1)
    o.add(o2)
    o.applyMatrix4(mat4(T_axisAngle(axis, angle)))
    object.add(o)
  }

  return object
}

const makeGrid = (axis, size) => {
  const position = []
  const jj = (axis + 1) % 3
  const kk = (axis + 2) % 3
  for (const [j, k] of [[jj, kk], [kk, jj]]) {
    for (const l of _.range(-size, size + 1)) {
      if (l === 0) { continue }
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
  const index = _.chunk(_.range(4 * num_lines), 4).map(quadToTriIndex)

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
  return result
}

const makeLineAA = (position, color) => {
  const num_lines = position.length - 1
  const index = _.chunk(_.range(4 * num_lines), 4).map(quadToTriIndex)

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
  return result
}

const makeDisk = (n, phi = 2 * PI) => {
  const circle = Utils.linspace(0, phi, n).map(x => [cos(x), sin(x), 0])
  const position = circle.concat([[0, 0, 0]])
  const k = phi === 2 * PI ? n : n + 1
  return Utils.makeBufferGeometry({
    position: position,
    normal: Array(position.length).fill([0, 0, 1]),
    index: _.range(n).map(i => [i, (i + 1) % k, n + 1])
  })
}

const getAttributeElement = (geometry, name, index) => {
  let attribute, itemSize
  if (name === 'index') {
    attribute = geometry.index
    itemSize = 3
  } else {
    attribute = geometry.attributes[name]
    itemSize = attribute.itemSize
  }
  return Array.from(attribute.array.slice(itemSize * index, itemSize * (index + 1)))
}

// no change in z
const makeWindowToNdc = (w, h) => {
  return [
    T_translate(vec3(-1, -1, 0)),
    diag(vec4(2 / w, 2 / h, 1, 1))
  ].reduce(M_mul)
}

// force z = -1
const makeNdcToCamera = (camera) => {
  const m00 = M_get(camera.projectionMatrix, 0, 0)
  const m11 = M_get(camera.projectionMatrix, 1, 1)
  return [
    T_translate(vec3(0, 0, -1)), // to z = -1
    diag(vec4(1 / m00, 1 / m11, 0, 1)) // inverse projection to z = 0
  ].reduce(M_mul)
}

const makeWindowToCamera = (w, h, camera) => {
  const windowToNdc = makeWindowToNdc(w, h)
  const ndcToCamera = makeNdcToCamera(camera)
  return M_mul(ndcToCamera, windowToNdc)
}

const makeWindowToRay = (w, h, camera) => {
  const windowToCamera = makeWindowToCamera(w, h, camera)
  return M_mul(mat4(mat3(camera.matrixWorld)), windowToCamera)
}

const makeWindowToWorld = (w, h, camera) => {
  const windowToCamera = makeWindowToCamera(w, h, camera)
  return M_mul(camera.matrixWorld, windowToCamera)
}

const checkShaderError = (renderer) => {
  const badPrograms = renderer.info.programs.filter(p =>
    p.diagnostics && !p.diagnostics.runnable)

  if (badPrograms.length === 0) { return false }

  // For some reason, webgl's log includes `\x00` (NULL)
  const format = (str) => str.replace(/\x00/g, ' ').trim() || '- - -' // eslint-disable-line

  let message = ''
  for (const p of badPrograms) {
    message += `\
${p.name}:
  program:  ${format(p.diagnostics.programLog)}
  vertex:   ${format(p.diagnostics.vertexShader.log)}
  fragment: ${format(p.diagnostics.fragmentShader.log)}
`
  }
  return message
}

const promiseLoaded = async (el) => {
  if (el.hasLoaded) { return el }
  await new Promise(resolve =>
    el.addEventListener('loaded', resolve, { once: true }))
  return el
}

const makeShaderMaterialV2 = (src, defines = []) => {
  const header = []
  const lines = src.split('\n')
  if (lines[0].startsWith('#version')) {
    header.push(lines.shift())
  }
  header.push(...defines.map(v => `#define ${v}`))
  const material = new THREE.RawShaderMaterial({
    vertexShader: [...header, '#define COMPILE_VERTEX', ...lines].join('\n'),
    fragmentShader: [...header, '#define COMPILE_FRAGMENT', ...lines].join('\n')
  })
  return material
}

const $ = (...args) => document.querySelector(...args)
const $$ = (...args) => Array.from(document.querySelectorAll(...args))

const stringToElement = (s) => {
  const template = document.createElement('template')
  template.innerHTML = s.trim()
  return template.content.firstChild
}

const makeCircle = (n, phi = 2 * PI) => {
  const circle = Utils.linspace(0, phi, n).map(x => [cos(x), sin(x), 0])
  return Utils.makeBufferGeometry({ position: circle })
}

const makeRaycasterFromWindow = (xy, w, h, camera) => {
  const windowToRay = makeWindowToRay(w, h, camera)
  const rayO = vec3(M_get(camera.matrixWorld, 3))
  const rayD = normalize(vec3(M_mul(windowToRay, vec4(xy, 0, 1))))
  const raycaster = new THREE.Raycaster(rayO, rayD)
  return raycaster
}

const windowDeltaToWorldDelta = (xyDelta, position, w, h, camera) => {
  const windowToCamera = makeWindowToCamera(w, h, camera)
  const deltaInCamera = M_mul(mat3(windowToCamera), vec3(xyDelta, 0))
  const depth = -M_mul(inverse(camera.matrixWorld), vec4(position, 1)).z
  const deltaInWorld = M_mul(mat3(camera.matrixWorld), M_mul(depth, deltaInCamera))
  return deltaInWorld
}

const applyWindowDelta = (xyDelta, object, w, h, camera) => {
  const position = vec3(M_get(object.matrixWorld, 3))
  const deltaWorld = windowDeltaToWorldDelta(xyDelta, position, w, h, camera)
  const deltaObject = M_mul(inverse(mat3(object.matrixWorld)), deltaWorld)
  object.applyMatrix4(T_translate(deltaObject))
}

const getPerspectiveScale = (position, w, camera) => {
  const z = M_mul(inverse(camera.matrixWorld), vec4(position, 1)).z // world -> camera
  const p = M_mul(camera.projectionMatrix, vec4(1, 0, z, 1)) // camera -> clip
  const x = (p.x / p.w) * (w / 2) // clip -> ndc -> window
  return x
}

const applyPerspectiveScale = (object, w, camera, scale) => {
  const position = vec3(M_get(object.matrixWorld, 3))
  const perspectiveScale = getPerspectiveScale(position, w, camera)
  object.scale.copy(vec3(scale / perspectiveScale))
}

export {
  Camera2dHelper, Camera3dHelper,
  makeDiskAlphaMap, makeGrid, makeAxes, quadToTriIndex,
  makeLineSegmentsAA, makeLineAA, makeDiskPoints, makeFrame,
  makeDisk, getAttributeElement,
  makeWindowToCamera, makeWindowToWorld, makeWindowToRay,
  checkShaderError, promiseLoaded, makeShaderMaterialV2, $, $$,
  stringToElement, makeCircle,
  makeRaycasterFromWindow, windowDeltaToWorldDelta, applyWindowDelta,
  getPerspectiveScale, applyPerspectiveScale
}
