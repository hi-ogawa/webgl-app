/* eslint camelcase: 0 */

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from './index.js'
import * as glm from './glm.js'
import * as ddg from './ddg.js'

const THREE = AFRAME.THREE

/* eslint-disable no-unused-vars */
const { PI, cos, sin, pow, sign, sqrt, cosh, sinh, acos, atan2 } = Math
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

const makeHedron20 = () => {
  // Apply spherical-cosine rule to equilateral-triangle-piramid
  //   cos(t) = cos(t)^2 + sin(t)^2 cos(p)
  //   => (1 - cos(p)) * cos(t)^2 - cos(t) + cos(p) = 0
  //   => cos(t) = cos(p) / (1 - cos(p))  (or 1)
  const p = 2 * PI / 5
  const t = acos(cos(p) / (1 - cos(p)))
  const theta = [
    0,
    ..._.range(5).fill(t),
    ..._.range(5).fill(PI - t),
    PI
  ]
  const phi = [
    0,
    ..._.range(5).map(i => p * i),
    ..._.range(5).map(i => p * (i + 0.5)),
    0
  ]
  const position = _.zip(theta, phi).map(([t, p]) => [
    sin(t) * cos(p),
    sin(t) * sin(p),
    cos(t)
  ])

  const index = [
    0, 1, 2,
    0, 2, 3,
    0, 3, 4,
    0, 4, 5,
    0, 5, 1,

    2, 1, 6,
    3, 2, 7,
    4, 3, 8,
    5, 4, 9,
    1, 5, 10,

    6, 7, 2,
    7, 8, 3,
    8, 9, 4,
    9, 10, 5,
    10, 6, 1,

    7, 6, 11,
    8, 7, 11,
    9, 8, 11,
    10, 9, 11,
    6, 10, 11
  ]
  return {
    position: position,
    index: _.chunk(index, 3)
  }
}

// Dual of cube [-1, 1]^3
const makeHedron8 = () => {
  const position = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
    0, -1, 0,
    0, 0, -1,
    -1, 0, 0
  ]
  const index = [
    0, 1, 2,
    0, 2, 3,
    0, 3, 4,
    0, 4, 1,
    5, 2, 1,
    5, 3, 2,
    5, 4, 3,
    5, 1, 4
  ]
  return {
    position: _.chunk(position, 3),
    index: _.chunk(index, 3)
  }
}

// Cube as quads
const makeQuadCube = () => {
  const position = [
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,
    0, 1, 0,
    0, 0, 1,
    1, 0, 1,
    1, 1, 1,
    0, 1, 1
  ]
  const index = [
    0, 3, 2, 1,
    0, 1, 5, 4,
    1, 2, 6, 5,
    2, 3, 7, 6,
    3, 0, 4, 7,
    4, 5, 6, 7
  ]
  return {
    position: _.chunk(position, 3),
    index: _.chunk(index, 4)
  }
}

const makeIcosphere = (n) => {
  const geometry = Utils.makeBufferGeometry(makeHedron20())
  for (const _i of _.range(n)) { // eslint-disable-line
    Utils.subdivTriforce(geometry)
  }
  // Convert back to array
  const { index, attributes: { position } } = geometry
  return {
    position: _.chunk(position.array, 3).map(p => glm.normalize(p)),
    index: _.chunk(index.array, 3)
  }
}

const makePlane = (segmentsX = 1, segmentsY = 1, periodicX = false, periodicY = false, triangle = true) => {
  const n = segmentsX
  const m = segmentsY

  // verts
  const xx = Utils.linspace(0, 1, n)
  const yy = Utils.linspace(0, 1, m)
  if (periodicX) { xx.pop() }
  if (periodicY) { yy.pop() }
  const position = yy.map(y => xx.map(x => [x, y, 0])).flat()

  // f2v
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
      const faces = triangle ? quadToTriIndex(quad) : [quad]
      index.push(...faces)
    }
  }

  return { position, index }
}

const makeParametric = (f, segmentsX, segmentsY, periodicX, periodicY, triangle) => {
  const { position, index } = makePlane(segmentsX, segmentsY, periodicX, periodicY, triangle)
  return { position: position.map(f), index }
}

const makeTorus = (r0 = 1, r1 = 0.5, segmentsX = 32, segmentsY = 16, triangle = true) => {
  const f = ([u, v]) => {
    u = 2 * PI * u
    v = 2 * PI * v
    const y = r1 * cos(v) + r0
    const z = r1 * sin(v)
    return [-sin(u) * y, cos(u) * y, z]
  }
  return makeParametric(f, segmentsX, segmentsY, true, true, triangle)
}

// f2v: int[nF, 4]
const extrudeFaces = (nV, f2v) => {
  // New geometry will have
  //   V' = 2 V
  //   E' = 2 E + Vb
  //   F' = 2 F + Vb
  // where
  //   Vb (= Eb): number of boundary vertices/edges

  // Flip orientation of bottom
  const f2v_bottom = _.cloneDeep(f2v).map(vs => [...vs].reverse())

  // Duplicate verts on top
  const f2v_top = _.cloneDeep(f2v).map(vs => vs.map(v => v + nV))

  // Make side face along boundary edges
  const { e2f, e2v } = ddg.computeTopology(f2v, nV)
  const f2v_side = []
  const nE = e2v.length
  for (const e of _.range(nE)) {
    // Boundary edge <=> having single face as neighbor
    if (e2f[e].length === 1) {
      const [v0, v1] = e2v[e]
      f2v_side.push([v0, v1, nV + v1, nV + v0])
    }
  }
  return _.concat(f2v_bottom, f2v_top, f2v_side)
}

// verts: float[nV, 3]
// f2v: int[nF, 4]
const subdivCatmullClerk = (verts, f2v) => {
  const nV = verts.length
  const nF = f2v.length
  const { e2v, v2ve, f2e } = ddg.computeTopology(f2v, nV)
  const nE = e2v.length

  const newVerts = _.range(nV + nE + nF).map(() => [0, 0, 0])
  const newF2v = []

  // Offset of edge/face point within new vertices
  const oE = nV
  const oF = nV + nE

  const { add, mul, div } = glm
  const assign = (a, b) => b.forEach((v, i) => { a[i] = v })
  const addAssign = (a, b) => assign(a, add(a, b))

  //
  // Subdivision mask of 3-deg 2d B-spline
  //
  // [ new face ]
  //   1 --- 1
  //   |  x  |
  //   1 --- 1
  //
  // [ new edge ]
  //   1 --- 1   =>   0 --- 0
  //   |     |   =>   |  1  |
  //   6 -x- 6   =>   2 -x- 2
  //   |     |   =>   |  1  |
  //   1 --- 1   =>   0 --- 0
  //
  // [ new vertex ]
  //   1 --- 6 --- 1   =>   0 --- 1 --- 0   =>    0 ------ 1/n
  //   |     |     |   =>   |  1  |  1  |   =>    |   1/n   |
  //   6 --- 36--- 6   =>   1 --- 8 --- 1   =>   1/n ----- n-2
  //   |     |     |   =>   |  1  |  1  |   =>   |    1/n
  //   1 --- 6 --- 1   =>   0 --- 1 --- 0   =>  (Catmull-Clerk's formula for non-regular vertex)
  //

  // Assuming surface without boundary, we can compute this by single loop
  for (const i of _.range(nF)) {
    // Make new face data
    const faceValue = div(f2v[i].map(v => verts[v]).reduce(add), 4)
    newVerts[oF + i] = faceValue

    for (const j of _.range(4)) {
      const v0 = f2v[i][j]
      const e0 = f2e[i][j][0]
      const v1 = f2v[i][(j + 1) % 4]
      const e1 = f2e[i][(j + 1) % 4][0]

      // New face by "f -> e0 -> v1 -> e1"
      newF2v.push([oF + i, oE + e0, v1, oE + e1])

      // Accumulate data between face/edge/vert
      // - face => edge
      addAssign(newVerts[oE + e0], div(faceValue, 4))

      // - vert => edge
      addAssign(newVerts[oE + e0], div(verts[v0], 4))

      // - ... => vert
      const n = v2ve[v0].length
      const acc = [
        faceValue, // face => vert
        verts[v1], // vert => vert
        mul(n - 2, verts[v0]) // vert => vert (self)
      ]
      addAssign(newVerts[v0], div(acc.reduce(add), n * n))
    }
  }

  return [newVerts, newF2v]
}

const makeGTorusQuad = (g) => {
  // Start from plane with enough width to make holes
  let { position, index } = makePlane(1 + 2 * g, 3, false, false, false)

  // Crop out interior faces
  for (const i of _.range(g).reverse()) {
    index.splice(4 + i * 6, 1)
  }

  // Extrude topology
  const nV = position.length
  index = extrudeFaces(nV, index)

  // Make extruded vertices
  const { add, sub, mul } = glm
  position.push(..._.cloneDeep(position).map(p => add(p, [0, 0, 1])))

  // Normalize positions
  position = position.map(p => mul(sub(p, 0.5), [1 + 2 * g, 3, 1]))
  return { position, index }
}

const makeGTorus = (g, subdiv = 0) => {
  let { position, index } = makeGTorusQuad(g)
  _.range(subdiv).forEach(() => {
    [position, index] = subdivCatmullClerk(position, index)
  })
  index = index.map(quadToTriIndex).flat()
  return { position, index }
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
  getPerspectiveScale, applyPerspectiveScale,
  makeHedron20, makeHedron8, makeIcosphere, makeQuadCube,
  makePlane, makeParametric, makeTorus,
  extrudeFaces, makeGTorus, subdivCatmullClerk
}
