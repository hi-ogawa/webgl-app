import _ from '../../web_modules/lodash.js';
import * as THREE from '../../web_modules/three/build/three.module.js';


class Array2d {
  constructor(array, stride) {
    this.array = array;
    this.stride = stride;
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
    var positions = [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0]];
    var normals = [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]];
    var uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    var faces = [[0, 1, 2], [0, 2, 3]];
    this.setAttribute('position', new THREE.Float32BufferAttribute(positions.flat(), 3));
    this.setAttribute('normal', new THREE.Float32BufferAttribute(normals.flat(), 3));
    this.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
    this.setIndex(faces.flat());
  }
}

export { Array2d, computeTopology, subdivTriforce, toIndexed, Quad };
