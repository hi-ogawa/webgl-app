//
// Custom shader (GLES3)
//

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import glsl_src from './index.glsl';


var camera, scene, renderer;
var error;

main();

async function main() {
  init();
  animate();
}

function init() {
  camera = new THREE.PerspectiveCamera(39 * 2, window.innerWidth / window.innerHeight, 1e-2, 1e2);
  camera.position.set(0.5, 0.4, 1).multiplyScalar(3.0)

  scene = new THREE.Scene();
  scene.add(new THREE.GridHelper());

  var glsl_header = [
    '#version 300 es',
    'precision mediump float;',
    'precision mediump int;',
  ];
  var shaderMaterial = new THREE.RawShaderMaterial({
    vertexShader:   [...glsl_header, '#define COMPILE_vertex',   glsl_src].join('\n'),
    fragmentShader: [...glsl_header, '#define COMPILE_fragment', glsl_src].join('\n'),
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 64), shaderMaterial));

  var canvas = document.createElement('canvas');
  var context = canvas.getContext('webgl2', { alpha: false });
  renderer = new THREE.WebGLRenderer({ canvas, context });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

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
