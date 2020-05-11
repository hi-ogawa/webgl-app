//
// A bit more organized structure
//

import _ from '../../web_modules/lodash.js';
import * as THREE from '../../web_modules/three/build/three.module.js'
import { OrbitControls } from '../../web_modules/three/examples/jsm/controls/OrbitControls.js';


class App {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
    this.resize();
  }

  resize() {
    this.width = this.renderer.domElement.clientWidth;
    this.height = this.renderer.domElement.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, /*updateStyle*/ false);
  }

  async init() {
    // Camera
    Object.assign(this.camera, { fov: 39 * 2, near : 1e-2, far : 1e2 });
    this.camera.position.set(0.5, 0.4, 1).multiplyScalar(2.0);
    new OrbitControls(this.camera, this.renderer.domElement);

    // Geometry
    this.scene.add(new THREE.GridHelper());
    this.scene.add(new THREE.Mesh(
        new THREE.BoxGeometry(), new THREE.MeshNormalMaterial()));
  }

  render() {
    this.resize();
    this.renderer.render(this.scene, this.camera);
  }
}

const main = async () => {
  // Create canvas
  var canvas = document.createElement('canvas');
  document.querySelector('#root').appendChild(canvas);

  // Create renderer
  var context = canvas.getContext('webgl2', { alpha: false });
  var renderer = new THREE.WebGLRenderer({ canvas, context });

  // Create app
  const app = new App(renderer);
  await app.init();

  // Main loop
  renderer.setAnimationLoop(() => {
    app.render();
    const bad_programs = app.renderer.info.programs.filter(p => p.diagnostics);
    if (bad_programs.length > 0) {
      window.alert('WebGLProgram error found');
      renderer.setAnimationLoop(null);
    }
  });
}

export { main }
