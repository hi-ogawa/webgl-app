import _ from '../../web_modules/lodash.js';
import * as THREE from '../../web_modules/three/build/three.module.js';
import { Vector2, Vector3, Vector4, Matrix3, Matrix4 } from '../../web_modules/three/build/three.module.js'
const { tan, atan, sin, cos } = Math;


class Array2d {
  constructor(array, stride) {
    if (Array.isArray(array)) {
      this.array = Float32Array(array.flat());
      this.stride = Array.isArray(array[0]) ? array[0].length : stride;
    } else {
      this.array = array;
      this.stride = stride;
    }
  }

  fromAttribute(attr) {
    this.array = attr.array;
    this.stride = attr.itemSize;
    return this;
  }

  get length() {
    return this.array.length / this.stride;
  }

  get([i, j]) {
    if (j === undefined) {
      return this.array.subarray(this.stride * i, this.stride * (i + 1));
    }
    return this.array[this.stride * i + j];
  }

  set([i, j], other) {
    if (j === undefined) {
      this.array.set(other, this.stride * i);
    }
    this.array[this.stride * i + j] = other;
  }

  mapInplace(func) {
    for (var i = 0; i < this.length; i++) {
      this.set([i], func(this.get([i])));
    }
  }
}

// @params:
//   index : Array
//   num_verts : int
function computeTopology(index, num_verts) {
  var num_faces = index.length / 3;

  // relation from face to ccw edges [[e0, e1, e2], ...]
  //   where index = [[v0, v1, v2], ...] has edge as v0--e0--v1
  var face_to_edge = new Array(num_faces).fill(0).map(() => new Array(3));

  // "directed (v0 < v1)" relation from vert to edge [[[v1, e0], ...], ...]
  var vert_to_edge = new Array(num_verts).fill(0).map(() => new Array());

  // from edge to vert [[v0, v1], ...]
  var edge_to_vert = new Array();

  for (var i = 0; i < num_faces; i++) {
    for (var j = 0; j < 3; j++) {
      var v0 = index[3 * i + j];
      var v1 = index[3 * i + (j + 1) % 3];
      var vm = Math.min(v0, v1);
      var vM = Math.max(v0, v1);
      var ve = vert_to_edge[vm].find(([v, _e]) => v == vM);
      if (!ve) {
        ve = [vM, edge_to_vert.length];
        vert_to_edge[vm].push(ve);
        edge_to_vert.push([vm, vM]);
      }
      face_to_edge[i][j] = ve[1];
    }
  }

  return [face_to_edge, vert_to_edge, edge_to_vert];
}


function subdivTriforce(geometry) {
  // Subdivide each triangle into
  //      /\
  //     /__\
  //    /\  /\
  //   /__\/__\
  //
  var index = geometry.index;
  var num_faces = index.count / 3;
  var num_verts = geometry.attributes.position.count;

  var [face_to_edge, __vert_to_edge, edge_to_vert] = computeTopology(index.array, num_verts);
  var num_edges = edge_to_vert.length;

  var new_num_faces = 4 * num_faces;
  var new_num_verts = num_verts + num_edges;
  var e_offset = num_verts;

  // Make new verts
  for (var attr of _.values(geometry.attributes)) {
    var old  = new Array2d(attr.array, attr.itemSize);
    var new_ = new Array2d(
        new attr.array.constructor(new_num_verts * attr.itemSize),
        attr.itemSize);
    for (var i of _.range(num_verts)) {
      new_.set([i], old.get([i]));
    }
    for (var i of _.range(num_edges)) {
      var [v0, v1] = edge_to_vert[i];
      var avg = _.zip(old.get([v0]), old.get([v1])).map(([x, y]) => (x + y) / 2);
      new_.set([e_offset + i], avg);
    }
    attr.array = new_.array;
    attr.count = new_num_verts;
  }

  // Make new faces
  var old_faces = new Array2d(index.array, 3);
  var new_faces = new Array2d(new index.array.constructor(new_num_faces * 3), 3);
  for (var i of _.range(num_faces)) {
    var [v0, v1, v2] = old_faces.get([i]);
    var [e0, e1, e2] = face_to_edge[i];
    new_faces.set([4 * i + 0], [e_offset + e0, e_offset + e1, e_offset + e2]);
    new_faces.set([4 * i + 1], [e_offset + e0,            v1, e_offset + e1]);
    new_faces.set([4 * i + 2], [e_offset + e1,            v2, e_offset + e2]);
    new_faces.set([4 * i + 3], [e_offset + e2,            v0, e_offset + e0]);
  }
  index.array = new_faces.array;
  index.count = new_num_faces * 3;
}


function toIndexed(geometry) {
  geometry.setIndex(_.range(geometry.attributes.position.count));
}


class Quad extends THREE.BufferGeometry {
  constructor() {
    super();
    var positions = [[-1, -1, 0], [+1, -1, 0], [+1, +1, 0], [-1, +1, 0]];
    var normals = [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]];
    var uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    var faces = [[0, 1, 2], [0, 2, 3]];
    this.setAttribute('position', new THREE.Float32BufferAttribute(positions.flat(), 3));
    this.setAttribute('normal', new THREE.Float32BufferAttribute(normals.flat(), 3));
    this.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
    this.setIndex(faces.flat());
  }
}

const makeBufferGeometry = (attributes) => {
  const g = new THREE.BufferGeometry();
  for (const [k, v] of _.toPairs(attributes)) {
    if (k == 'index') {
      g.setIndex(v.flat());
      continue;
    }
    if (Array.isArray(v[0])) {
      const itemSize = v[0].length;
      const attr = new THREE.Float32BufferAttribute(v.flat(), 3)
      g.setAttribute(k, attr);
      continue;
    }
  }
  return g;
}


const makeShaderMaterial = (src, defines = {}) => {
  const header = [
    '#version 300 es',
    'precision mediump float;',
    'precision mediump int;',
    ..._.toPairs(defines).map(([k, v]) => `#define ${ k } ${ v }`),
  ];
  const material = new THREE.RawShaderMaterial({
    vertexShader:   [...header, `#define COMPILE_VERTEX`,   src].join('\n'),
    fragmentShader: [...header, '#define COMPILE_FRAGMENT', src].join('\n'),
  });
  return material;
}

const linspace = (x0, x1, num) => {
  return (
    _.range(num + 1)
     .map(i => i / num)
     .map(t => x0 + t * (x1 - x0))
  );
}

const vec2 = (...args) => {
  if (args.length == 1) {
    const a = args[0];
    if (typeof a === 'number') {
      return vec2(a, a);
    }
  }
  const es = args.map(e => e.toArray ? e.toArray() : [e]).flat();
  return new Vector2(...es);
}

const vec3 = (...args) => {
  if (args.length == 1) {
    const a = args[0];
    if (typeof a === 'number') {
      return vec3(a, a, a);
    }
  }
  const es = args.map(e => e.toArray ? e.toArray() : [e]).flat();
  return new Vector3(...es);
}

const vec4 = (...args) => {
  if (args.length == 1) {
    const a = args[0];
    if (typeof a === 'number') {
      return vec4(a, a, a, a);
    }
  }
  const es = args.map(e => e.toArray ? e.toArray() : [e]).flat();
  return new Vector4(...es);
}

const mat3 = (...args) => {
  if (args.length == 1) {
    const a = args[0];
    if (a.isMatrix4) {
      const e = a.elements;
      return mat3(
          e[0], e[1], e[2],
          e[4], e[5], e[6],
          e[8], e[9], e[10]);
    }
    if (typeof a === 'number') {
      return M_mul(a, new Matrix3());
    }
  }
  const es = args.map(e => e.toArray ? e.toArray() : [e]).flat();
  if (es.length == 9) {
    const m = new Matrix3();
    m.elements = es;
    return m;
  }
  throw new Error('mat3');
}

const mat4 = (...args) => {
  if (args.length == 1) {
    const a = args[0];
    if (a.isMatrix3) {
      const e = a.elements;
      return mat4(
          e[0], e[1], e[2], 0,
          e[3], e[4], e[5], 0,
          e[6], e[7], e[8], 0,
             0,    0,    0, 1);
    }
    if (typeof a === 'number') {
      return M_mul(a, new Matrix4());
    }
  }
  const es = args.map(e => e.toArray ? e.toArray() : [e]).flat();
  if (es.length == 16) {
    const m = new Matrix4();
    m.elements = es;
    return m;
  }
  throw new Error('mat4');
}

const M_add = (a, b) => {
  // Matrix + Matrix
  if (a.isMatrix4 && b.isMatrix4) {
    return mat4(..._.zip(a.toArray(), b.toArray()).map(([c, d]) => c + d));
  }
  if (a.isMatrix3 && b.isMatrix3) {
    return mat3(..._.zip(a.toArray(), b.toArray()).map(([c, d]) => c + d));
  }

  // Vector + Vector
  if (a.isVector4 && b.isVector4) {
    return a.clone().add(a);
  }
  if (a.isVector3 && b.isVector3) {
    return a.clone().add(b);
  }
  if (a.isVector2 && b.isVector2) {
    return a.clone().add(b);
  }

  // Scalar
  if (typeof a === 'number' && typeof b === 'number') {
    return a + b;
  }
  if (typeof a === 'number') {
    return b.clone().addScalar(a);
  }
  if (typeof b === 'number') {
    return a.clone().addScalar(b);
  }

  throw new Error('M_add');
}

const M_mul = (a, b) => {
  // Matrix x Matrix
  if (a.isMatrix4 && b.isMatrix4) {
    return new Matrix4().multiplyMatrices(a, b);
  }
  if (a.isMatrix3 && b.isMatrix3) {
    return new Matrix3().multiplyMatrices(a, b);
  }

  // Matrix x Vector
  if (a.isMatrix4 && b.isVector4) {
    return b.clone().applyMatrix4(a);
  }
  if (a.isMatrix3 && b.isVector3) {
    return b.clone().applyMatrix3(a);
  }

  // Vector x Vector
  if (a.isVector4 && b.isVector4) {
    return a.clone().multiply(b);
  }
  if (a.isVector3 && b.isVector3) {
    return a.clone().multiply(b);
  }
  if (a.isVector2 && b.isVector2) {
    return a.clone().multiply(b);
  }

  // Scalar
  if (typeof a === 'number' && typeof b === 'number') {
    return a * b;
  }
  if (typeof a === 'number') {
    return b.clone().multiplyScalar(a);
  }
  if (typeof b === 'number') {
    return a.clone().multiplyScalar(b);
  }

  throw new Error('M_mul');
}

const M_reciprocal = (m) => {
  return m.clone().fromArray(m.toArray().map(x => 1 / x));
}

const M_diag = (p) => {
  if (p.isVector3) {
    const [a, b, c] = p.toArray();
    return mat3(
        a, 0, 0,
        0, b, 0,
        0, 0, c);
  }
  if (p.isVector4) {
    const [a, b, c, d] = p.toArray();
    return mat4(
        a, 0, 0, 0,
        0, b, 0, 0,
        0, 0, c, 0,
        0, 0, 0, d);
  }
  throw new Error('M_diag');
}

const M_inverse = (m) => {
  return m.clone().getInverse(m);
}


const yfovFromHeight = (height) => {
  return 2 * atan(height / 2);
}

const T_orthographic = (yfov, aspect_ratio, near, far) => {
  const half_h = tan(yfov / 2);
  const half_w = aspect_ratio * half_h;
  const a = -    1 / (far - near);
  const b = - near / (far - near);
  const c = 1 / half_w;
  const d = 1 / half_h;
  return mat4(
      c, 0, 0, 0,
      0, d, 0, 0,
      0, 0, a, 0,
      0, 0, b, 1);
}

const T_scale = (p) => {
  if (p.isVector3) {
    const [a, b, c] = p.toArray();
    return mat3(
        a, 0, 0,
        0, b, 0,
        0, 0, c);
  }
  if (p.isVector4) {
    const [a, b, c, d] = p.toArray();
    return mat4(
        a, 0, 0, 0,
        0, b, 0, 0,
        0, 0, c, 0,
        0, 0, 0, d);
  }
  throw new Error('T_scale');
}

const T_translate = (p) => {
  if (p.isVector2) {
    return mat3(
        1, 0, 0,
        0, 1, 0,
        ...p.toArray(), 1);
  }
  if (p.isVector3) {
    return mat4(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        ...p.toArray(), 1);
  }
  throw new Error('T_translate');
}

function cross_as_mat(v) {
  return mat3(
     0.0, +v.z, -v.y,
    -v.z,  0.0, +v.x,
    +v.y, -v.x,  0.0);
}

function outer(u, v) {
  return mat3(M_mul(u, v.x), M_mul(u, v.y), M_mul(u, v.z));
}

function outer2(v) {
  return outer(v, v);
}

function dot(u, v) {
  return _.sum(M_mul(u, v).toArray());
}

function dot2(v) {
  return dot(v, v);
}

function pow2(x) {
  return M_mul(x, x);
}

function Q_toSO3(q) {
  const v = vec3(q);
  const s = q.w;
  const I = mat3(1);
  const Cv = cross_as_mat(v);
  return (
    M_add(
      M_add(
        M_mul(2, outer2(v)),
        M_mul(pow2(s) - dot2(v), I)
      ),
      M_mul(2 * s, Cv)
    )
  );
}

function Q_fromAxisAngle(u, t) {
  return vec4(M_mul(sin(0.5 * t), u), cos(0.5 * t));
}

function T_axisAngle(u, t) {
  return Q_toSO3(Q_fromAxisAngle(u, t));
}

function T_rotate(t) {
  return mat3(
      cos(t), sin(t), 0,
    - sin(t), cos(t), 0,
           0,      0, 1);
}


export {
  Array2d, computeTopology, subdivTriforce, toIndexed, Quad,
  makeShaderMaterial, makeBufferGeometry,
  linspace,
  yfovFromHeight, T_orthographic,
  T_scale, T_translate, T_axisAngle, T_rotate,
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_mul, M_diag, M_inverse, M_reciprocal,
  pow2,
};
