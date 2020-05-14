//
// Curvature and osculating circle
//

import _ from '../../web_modules/lodash.js';
import * as THREE from '../../web_modules/three/build/three.module.js'
import { GUI } from '../../web_modules/three/examples/jsm/libs/dat.gui.module.js';
import * as Utils from '../utils/index.js';

const { PI, cos, sin, sqrt } = Math;
const { Vector2, Vector3, Vector4, Matrix3, Matrix4 } = THREE;
const {
  vec2, vec3, vec4, mat3, mat4,
  M_add, M_mul, M_diag, M_inverse,
  T_translate, T_rotate, T_axisAngle,
  pow2,
} = Utils;


class App {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.width = this.height = 0;
    this.uniforms = {
      U_time: { value: 0 },
      U_resolution: { value: vec2(0, 0) },
      U_window_to_world: { value: mat4(1) },
      U_point_size: { value: 8 },
    };
    this.time = null;
    this.gui = new GUI();

    this.camera_xy = vec2(0, 0);
    this.zoom = 0; // = log_2(scale) so it's additive
    this.fov_height = 16;
    this.window_to_world = mat4(1.0);
    this.mouse_p = vec2(2, 0); // in world frame

    this.f = (x) => 0.5 * x * sin(x);
    this._updateSize();
  }

  _updateSize() {
    const canvas = this.renderer.domElement;
    const { clientWidth: w_css, clientHeight: h_css } = canvas;
    if (this.width == w_css && this.height == h_css) { return; }

    this.width = w_css;
    this.height = h_css;

    this.renderer.setSize(w_css, h_css, /*updateStyle*/ false);
    const { width: w_res, height: h_res } = canvas;
    this.uniforms.U_resolution.value = vec2(w_res, h_res);

    this._updateMatrix();
  }

  _updateMatrix() {
    this.camera.position.copy(vec3(this.camera_xy, 1e2));
    this.camera.updateMatrix();

    this.camera.projectionMatrix = Utils.T_orthographic(
        Utils.yfovFromHeight(Math.pow(2, this.zoom) * this.fov_height),
        this.width / this.height, 1e-2, 1e3);

    this.window_to_camera = [
      M_diag(vec4(1, 1, 0, 1)),                // to z = 0
      M_inverse(this.camera.projectionMatrix), // inverse projection
      T_translate(vec3(-1, -1, 0)),                       // window to ndc (translate)
      M_diag(vec4(2 / this.width, 2 / this.height, 0, 1)) // window to ndc (scale)
    ].reduce(M_mul);

    this.window_to_world = [
      M_diag(vec4(1, 1, 0, 1)),    // to z = 0
      this.camera.matrix,
      T_translate(vec3(0, 0, -1)), // to z = -1
      this.window_to_camera,
    ].reduce(M_mul)

    this.uniforms.U_window_to_world.value = this.window_to_world;
  }

  _updateTime() {
    const now = performance.now();
    this.time = this.time || now;
    this.uniforms.U_time.value += (this.time - now) / 1000;
    this.time = now;
  }

  _checkShaderError() {
    const bad_programs = this.renderer.info.programs.filter(p => p.diagnostics);
    if (bad_programs.length > 0) {
      this.stop();
      var message = '';
      for (const p of bad_programs) {
        const d = p.diagnostics;
        message += `\
${p.name}:
  program:  ${d.programLog}
  vertex:   ${d.vertexShader.log}
  fragment: ${d.fragmentShader.log}
`;
      }
      window.alert(`[ShaderError]\n${message}`);
    }
  }

  _yflip(y) { return this.height - y - 1; }

  $(name) {
    return this.scene.getObjectByName(name);
  }

  mousedown(event) {
    if (event.buttons === 1) {
      if (event.shiftKey) { return; }
      const { clientX : x, clientY : y } = event;
      this.mouse_p = vec2(M_mul(
          this.window_to_world, vec4(x, this._yflip(y), 0, 1)));
    }
  }

  mousemove(event) {
    if (event.buttons === 1) {
      const { clientX : x, clientY : y, movementX : dx, movementY : dy } = event;
      if (event.shiftKey) {
        this.camera_xy.add(
            vec2(M_mul(mat3(this.window_to_camera), vec3(-dx, dy, 0))));
        this._updateMatrix();
        return;
      }

      this.mouse_p = vec2(M_mul(
          this.window_to_world, vec4(x, this._yflip(y), 0, 1)));
    }
  }

  wheel(event) {
    const { clientX : x, clientY : y, deltaY : dy } = event;
    const dzoom = dy / 1024;

    // Preserve "mouse"
    // <=> camera' + to_camera' * mouse = camera + to_camera * mouse
    // <=> camera' = camera + (to_camera - to_camera') * mouse
    const mouse = vec4(x, this._yflip(y), 0, 1);
    const prev = this.window_to_camera.clone();
    this.zoom += dzoom;
    this._updateMatrix();
    this.camera_xy.add(
        vec2(M_mul(M_add(prev, M_mul(-1, this.window_to_camera)), mouse)));
    this._updateMatrix();
  }

  async init() {
    // Gui
    const gui_params = {
      play: true,
      f: '0.5 * x * sin(x)',
    }
    this.gui.add(gui_params, 'play').onFinishChange(b => b ? this.start() : this.stop());
    this.gui.add(gui_params, 'f').onFinishChange(s => {
      this.f = eval(`(x) => ${ s }`);
      const xs = Utils.linspace(-20, 20, 256);
      const position = xs.map(x => [x, this.f(x), 0]);
      this.$('graph').geometry = Utils.makeBufferGeometry({ position });
    });

    // Fetch glsl
    const index_glsl = await (await fetch('./index.glsl')).text();

    // Axes/Grid
    {
      {
        const grid = new THREE.GridHelper(32, 32);
        grid.applyMatrix4(mat4(T_axisAngle(vec3(1, 0, 0), 0.5 * PI)));
        grid.position.copy(vec3(0, 0, -3));
        this.scene.add(grid);
      }

      {
        const geometry = Utils.makeBufferGeometry({
          position: [[-1, 0, 0], [+1, 0, 0], [0, -1, 0], [0, +1, 0]],
          color: [[1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 0]],
        });
        const axes = new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false }))
        axes.scale.copy(vec3(1e3, 1e3, 1));
        axes.position.copy(vec3(0, 0, -2));
        this.scene.add(axes);
      }
    }

    // Points (tangent point and circle center)
    {
      const geometry = Utils.makeBufferGeometry({ position: [[0, 0, 0], [0, 0, 0]] });
      const material = Utils.makeShaderMaterial(index_glsl, { Main01: 1 });
      material.uniforms = this.uniforms;
      material.transparent = true;

      const object = new THREE.Points(geometry, material);
      object.name = 'points';
      this.scene.add(object);
    }

    // Graph y = f(x)
    {
      const xs = Utils.linspace(-20, 20, 256);
      const position = xs.map(x => [x, this.f(x), 0]);
      const geometry = Utils.makeBufferGeometry({ position });
      const object = new THREE.Line(geometry, new THREE.LineBasicMaterial())
      object.name = 'graph';
      this.scene.add(object);
    }

    // circle
    {
      const xs = Utils.linspace(0, 2 * PI, 128);
      const position = xs.map(x => [cos(x), sin(x), 0]);
      const geometry = Utils.makeBufferGeometry({ position });
      const object = new THREE.Line(geometry, new THREE.LineBasicMaterial());
      object.name = 'circle';
      this.scene.add(object);
    }

    // line x = x0
    {
      const xs = Utils.linspace(0, 2 * PI, 128);
      const position = [[0, -1e2, 0], [0, 1e2, 0]];
      const geometry = Utils.makeBufferGeometry({ position });
      const object = new THREE.Line(geometry, new THREE.LineBasicMaterial())
      object.name = 'x = x0';
      this.scene.add(object);
    }
  }

  start() {
    this.time = null;
    this.renderer.setAnimationLoop(() => {
      this.update();
      this.render();
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  update() {
    this._updateSize();
    this._updateTime();

    {
      const x = this.mouse_p.x;
      const y = this.f(x);
      const dx = 1e-3;
      const dy = (this.f(x + dx) - this.f(x - dx)) / (2 * dx);
      const ddy = (this.f(x + dx) + this.f(x - dx) - 2 * y) / pow2(dx);
      const ddg = M_mul(ddy / pow2(1 + pow2(dy)), vec2(-dy, 1)); // g : arc-length parametrized curve (x, f(x))
      const k = ddg.length();
      const u = vec2(ddg).normalize();
      const radius = 1 / k;
      const center = M_add(M_mul(radius, u), vec2(x, y));

      this.$('x = x0').position.copy(vec3(x, 0, 0));
      this.$('points').geometry.attributes.position.setXYZ(0, x, y, 0);
      this.$('points').geometry.attributes.position.setXYZ(1, ...center.toArray(), 0);
      this.$('points').geometry.attributes.position.needsUpdate = true;
      this.$('circle').position.copy(vec3(center, 0));
      this.$('circle').scale.copy(vec3(radius));
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this._checkShaderError();
  }
}


const main = async () => {
  // Create canvas
  const canvas = document.createElement('canvas');
  document.querySelector('#root').appendChild(canvas);

  // Create renderer
  const context = canvas.getContext('webgl2', { alpha: false });
  const renderer = new THREE.WebGLRenderer({ canvas, context });

  // Create app
  const app = new App(renderer);
  await app.init();

  // Setup handler
  const event_names = ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'wheel'];
  for (const name of event_names) {
    canvas.addEventListener(name, (e) => app[name] && app[name](e));
  }

  // Start
  app.start();
}

export { main }
