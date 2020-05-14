//
// Custom geometry and attribute
//

import _ from '../../web_modules/lodash.js';
import * as THREE from '../../web_modules/three/build/three.module.js'
import { OrbitControls } from '../../web_modules/three/examples/jsm/controls/OrbitControls.js';
import { Array2d, subdivTriforce, toIndexed } from '../utils/index.js';

var camera, scene, renderer;
var error;
var glsl_src;

async function main() {
  glsl_src = await (await fetch('./index.glsl')).text();
  init();
  animate();
}

function makeMesh() {
  var geometry;
  {
    geometry = new THREE.IcosahedronBufferGeometry(1.0);

    // `subdivTriforce` requires `geometry.index`
    if (!geometry.index) { toIndexed(geometry); }

    // Subdivide
    for (var __ of _.range(2)) {
      subdivTriforce(geometry);
    }

    // Project to sphere
    var position = geometry.attributes.position;
    var arr = new Array2d().fromAttribute(position);
    arr.mapInplace(p => new THREE.Vector3(...p).normalize().toArray());

    // Split vertices shared by multiple faces
    geometry = geometry.toNonIndexed();

    // Make new attribute
    // (of course, same can be achieved without this attribute using `gl_VertexId % 3`)
    var num_faces = geometry.attributes.position.count / 3;
    var custom_uv = new Array2d(new Float32Array(num_faces * 3 * 2), 3 * 2);
    custom_uv.mapInplace(() => [[0, 0], [1, 0], [0, 1]].flat());

    geometry.setAttribute('custom_uv', new THREE.BufferAttribute(custom_uv.array, 2));
  }

  var glsl_header = [
    '#version 300 es',
    'precision mediump float;',
    'precision mediump int;',
  ];
  var shaderMaterial = new THREE.RawShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      U_width: { value: 2.0 },
      U_aa : { value: 1.5 }
    },
    vertexShader:   [...glsl_header, '#define COMPILE_vertex',   glsl_src].join('\n'),
    fragmentShader: [...glsl_header, '#define COMPILE_fragment', glsl_src].join('\n'),
  });

  return new THREE.Mesh(geometry, shaderMaterial);
}

function init() {
  scene = new THREE.Scene();
  scene.add(new THREE.GridHelper());
  scene.add(makeMesh());

  var canvas = document.createElement('canvas');
  var context = canvas.getContext('webgl2', { alpha: false });
  renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(39, window.innerWidth / window.innerHeight, 1e-2, 1e2);
  camera.position.set(0.5, 0.4, 1).multiplyScalar(3.0)
  new OrbitControls(camera, renderer.domElement);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function animate() {
  if(error) { return; }
  requestAnimationFrame( animate );
  renderer.render( scene, camera );
  check();
}

function check() {
  for (var prog of renderer.info.programs) {
    if (prog.diagnostics) {
      window.alert('Found WebGLProgram Error');
      error = prog.diagnostics;
    }
  }
}

export { main }
