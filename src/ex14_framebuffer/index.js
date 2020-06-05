/* eslint camelcase: 0 */

//
// Render to framebuffer
// (shader is from ex44 of https://github.com/hi-ogawa/python-shader-app)
//

import _ from '../../web_modules/lodash.js'
import AFRAME from '../../web_modules/aframe.js'
import * as Utils from '../utils/index.js'
import * as UtilsMisc from '../utils/misc.js'
import { patchAframeThree } from '../utils/aframe/misc.js'
import '../utils/aframe/input.js'
import '../utils/aframe/orbit-controls.js'
import '../utils/aframe/mouse-raycaster.js'

/* eslint-disable no-unused-vars */
const THREE = AFRAME.THREE
const { PI, cos, sin, pow, sqrt, cosh, sinh } = Math
const {
  vec2, vec3, vec4, mat2, mat3, mat4,
  M_add, M_sub, M_mul, M_div, M_get,
  T_translate, T_axisAngle,
  dot, inverse, cross, normalize, transpose,
  diag, pow2, smoothstep01, dot2, outer, outer2,
  eigen_mat2, sqrt_mat2,
  toColor
} = Utils
const { $ } = UtilsMisc
/* eslint-enable no-unused-vars */

class DoubleBuffer {
  constructor (width, height, options) {
    this.read = new THREE.WebGLRenderTarget(
      width, height, options)
    this.write = this.read.clone()
  }

  swapBuffers () {
    [this.read, this.write] = [this.write, this.read]
  }
}

AFRAME.registerComponent('main', {
  init () {
    this.camera = new THREE.Camera()
    this.geometry = Utils.makeBufferGeometry({
      position: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]],
      index: [[0, 1, 2], [0, 2, 3]]
    })
    this.mesh = new THREE.Mesh(this.geometry)
    this.mesh.frustumCulled = false
    this.clock = new THREE.Clock()
    this.renderer = this.el.sceneEl.renderer
    this.frame = 0
    this.configure()
  },

  play () {
    this.clock.start()
  },

  pause () {
    this.clock.stop()
  },

  tick () {
    this.timeDelta = this.clock.getDelta()
    this.uniforms = {
      U_time: { value: this.clock.elapsedTime },
      U_timeDelta: { value: this.timeDelta },
      U_frame: { value: this.frame++ }
    }
    this.execute()

    const message = UtilsMisc.checkShaderError(this.renderer)
    if (message) {
      window.alert(`[ShaderError]\n${message}`)
      this.pause()
    }
    this.renderer.setRenderTarget(null)
  },

  async configure () {
    const shaderEl = await UtilsMisc.promiseLoaded($('#shader'))

    this.buffers = {
      buffer1: new DoubleBuffer(512, 512, {
        format: THREE.RGFormat,
        type: THREE.HalfFloatType, // On my phone, float texture is not supported
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.RepeatWrapping,
        depthBuffer: false,
        stencilBuffer: false
      }),
      display: {
        write: new THREE.WebGLRenderTarget(512, 512)
      }
    }

    this.programs = {
      program1: {
        material: UtilsMisc.makeShaderMaterialV2(shaderEl.data, ['MAIN01']),
        inputs: ['buffer1'],
        output: 'buffer1'
      },
      program2: {
        material: UtilsMisc.makeShaderMaterialV2(shaderEl.data, ['MAIN02']),
        inputs: ['buffer1'],
        output: 'display'
      }
    }

    $('#display').object3DMap.mesh.material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide
    })
  },

  setUniforms (program) {
    _.assign(program.material.uniforms, this.uniforms)
    for (const name of program.inputs) {
      const { texture } = this.buffers[name].read
      const { width, height } = texture.image
      _.assign(program.material.uniforms, {
        [`U_${name}`]: { value: texture },
        [`U_${name}_resolution`]: { value: vec2(width, height) }
      })
    }
  },

  render (program) {
    this.renderer.setRenderTarget(this.buffers[program.output].write)
    this.mesh.material = program.material
    this.renderer.render(this.mesh, this.camera)
  },

  execute () {
    const { program1, program2 } = this.programs
    const { buffer1, display } = this.buffers

    const isects = $('#display').components['mouse-raycaster'].intersections
    const isect_uv = isects.length === 0 ? vec2(-1) : isects[0].uv
    this.uniforms.U_mouse_uv = { value: isect_uv }

    // Solve PDE
    const numSubsteps = 2 // TODO: make it substep independent
    _.range(numSubsteps).forEach(() => {
      this.setUniforms(program1)
      this.render(program1)
      buffer1.swapBuffers()
    })

    // Visualize
    this.setUniforms(program2)
    this.render(program2)

    $('#display').object3DMap.mesh.material.map = display.write.texture
  }
})

AFRAME.registerComponent('mouse-raycaster-enable-on-alt', {
  tick () {
    const { keys } = this.el.sceneEl.systems.input.state
    this.el.components['mouse-raycaster'].data.enable = keys.Alt
  }
})

const main = () => {
  Utils.patchThreeMath()
  patchAframeThree()
  const scene = $('#scene').content.cloneNode(true)
  $('#root').appendChild(scene)
}

export { main }
